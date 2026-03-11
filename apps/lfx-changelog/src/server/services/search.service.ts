// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { BLOGS_INDEX, BULK_BATCH_SIZE, CHANGELOGS_INDEX } from '@lfx-changelog/shared';
import { Client } from '@opensearch-project/opensearch';

import { serverLogger } from '../server-logger';
import { getPrismaClient } from './prisma.service';

import type { AggregationContainer } from '@opensearch-project/opensearch/api/_types/_common.aggregations.js';

import type {
  BlogDocument,
  ChangelogDocument,
  FacetBucket,
  OpenSearchAggBucket,
  OpenSearchBulkAction,
  OpenSearchBulkResponse,
  SearchHit,
  SearchQueryParams,
  SearchResponse,
  SearchTarget,
} from '@lfx-changelog/shared';
// ── Per-target index configuration ──────────────────────────────────────────

type FacetConfig = {
  agg: AggregationContainer;
  extractBucket: (bucket: OpenSearchAggBucket) => FacetBucket;
};

type IndexConfig = {
  index: string;
  fields: string[];
  filterKeys: string[];
  facets: Record<string, FacetConfig>;
};

const INDEX_CONFIGS: Record<SearchTarget, IndexConfig> = {
  changelogs: {
    index: CHANGELOGS_INDEX,
    fields: ['title^3', 'description', 'productName^2', 'version'],
    filterKeys: ['productId'],
    facets: {
      products: {
        agg: {
          terms: { field: 'productId', size: 50 },
          aggs: { product_name: { terms: { field: 'productName.keyword', size: 1 } } },
        },
        extractBucket: (bucket) => ({
          key: bucket.key,
          label: bucket.product_name?.buckets?.[0]?.key || 'Unknown',
          count: bucket.doc_count,
        }),
      },
    },
  },
  blogs: {
    index: BLOGS_INDEX,
    fields: ['title^3', 'description', 'excerpt', 'productNames^2', 'authorName'],
    filterKeys: ['type'],
    facets: {
      types: {
        agg: {
          terms: { field: 'type', size: 10 },
        },
        extractBucket: (bucket) => ({
          key: bucket.key,
          count: bucket.doc_count,
        }),
      },
    },
  },
};

// Module-level client singleton — shared across all SearchService instances
let osClient: Client | null = null;

// ── Blog document mapping helper ─────────────────────────────────────────────
// Shared between BlogService.syncToOpenSearch() and SearchService.reindexAllBlogs()

type BlogWithRelationsForIndex = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  description: string;
  type: string;
  status: string;
  coverImageUrl: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  author?: { name: string | null; avatarUrl: string | null } | null;
  products?: { product: { id: string; name: string } }[] | null;
};

export function toBlogDocument(blog: BlogWithRelationsForIndex): BlogDocument {
  return {
    id: blog.id,
    slug: blog.slug,
    title: blog.title,
    excerpt: blog.excerpt,
    description: blog.description,
    type: blog.type,
    status: blog.status,
    coverImageUrl: blog.coverImageUrl,
    publishedAt: blog.publishedAt?.toISOString() ?? null,
    createdAt: blog.createdAt.toISOString(),
    authorName: blog.author?.name ?? 'Unknown',
    authorAvatarUrl: blog.author?.avatarUrl ?? null,
    productNames: blog.products?.map((p) => p.product.name) ?? [],
    productIds: blog.products?.map((p) => p.product.id) ?? [],
  };
}

export class SearchService {
  // ── OpenSearch client ───────────────────────────

  /**
   * Returns the shared OpenSearch client. Returns `null` if OPENSEARCH_URL is not set,
   * allowing the app to degrade gracefully without search.
   */
  public getClient(): Client | null {
    const url = process.env['OPENSEARCH_URL'];
    if (!url) {
      return null;
    }

    if (!osClient) {
      osClient = new Client({ node: url });
      const safeUrl = (() => {
        try {
          const parsed = new URL(url);
          return `${parsed.protocol}//${parsed.host}`;
        } catch {
          return '[invalid URL]';
        }
      })();
      serverLogger.info({ node: safeUrl }, 'OpenSearch client initialized');
    }
    return osClient;
  }

  /**
   * Creates the changelogs index with the appropriate mapping if it doesn't exist.
   */
  public async ensureIndex(): Promise<void> {
    const os = this.getClient();
    if (!os) {
      serverLogger.info('OpenSearch not configured — skipping index creation');
      return;
    }

    try {
      const exists = await os.indices.exists({ index: CHANGELOGS_INDEX });
      if (exists.body) {
        serverLogger.info(`OpenSearch index "${CHANGELOGS_INDEX}" already exists`);
        return;
      }

      await os.indices.create({
        index: CHANGELOGS_INDEX,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
          },
          mappings: {
            properties: {
              id: { type: 'keyword' },
              slug: { type: 'keyword' },
              title: { type: 'text', boost: 3 },
              description: { type: 'text' },
              version: { type: 'keyword' },
              status: { type: 'keyword' },
              publishedAt: { type: 'date' },
              createdAt: { type: 'date' },
              productId: { type: 'keyword' },
              productName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              productSlug: { type: 'keyword' },
              productFaIcon: { type: 'keyword' },
            },
          },
        },
      });

      serverLogger.info(`Created OpenSearch index: ${CHANGELOGS_INDEX}`);
    } catch (error) {
      await this.disconnect();
      throw error;
    }
  }

  /**
   * Index a single changelog document by ID (upsert).
   */
  public async indexDocument(doc: ChangelogDocument): Promise<void> {
    const os = this.getClient();
    if (!os) return;

    await os.index({
      index: CHANGELOGS_INDEX,
      id: doc.id,
      body: doc,
    });
  }

  /**
   * Delete a changelog document from the index. Silently ignores 404.
   * Uses `refresh: 'wait_for'` so the deletion is immediately visible.
   */
  public async deleteDocument(id: string): Promise<void> {
    const os = this.getClient();
    if (!os) return;

    try {
      await os.delete({
        index: CHANGELOGS_INDEX,
        id,
        refresh: 'wait_for',
      });
    } catch (error: unknown) {
      const statusCode = (error as { meta?: { statusCode?: number } })?.meta?.statusCode;
      if (statusCode !== 404) {
        throw error;
      }
    }
  }

  /**
   * Pings the OpenSearch cluster. Returns true if reachable, false otherwise.
   */
  public async ping(): Promise<boolean> {
    const os = this.getClient();
    if (!os) return false;

    try {
      const response = await os.ping();
      return response.statusCode === 200;
    } catch {
      return false;
    }
  }

  /**
   * Closes the OpenSearch client connection.
   */
  public async disconnect(): Promise<void> {
    if (osClient) {
      await osClient.close();
      osClient = null;
      serverLogger.info('OpenSearch client disconnected');
    }
  }

  // ── Blog index operations ──────────────────────

  /**
   * Creates the blogs index with the appropriate mapping if it doesn't exist.
   */
  public async ensureBlogsIndex(): Promise<void> {
    const os = this.getClient();
    if (!os) {
      serverLogger.info('OpenSearch not configured — skipping blogs index creation');
      return;
    }

    try {
      const exists = await os.indices.exists({ index: BLOGS_INDEX });
      if (exists.body) {
        serverLogger.info(`OpenSearch index "${BLOGS_INDEX}" already exists`);
        return;
      }

      await os.indices.create({
        index: BLOGS_INDEX,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
          },
          mappings: {
            properties: {
              id: { type: 'keyword' },
              slug: { type: 'keyword' },
              title: { type: 'text', boost: 3 },
              excerpt: { type: 'text' },
              description: { type: 'text' },
              type: { type: 'keyword' },
              status: { type: 'keyword' },
              coverImageUrl: { type: 'keyword' },
              publishedAt: { type: 'date' },
              createdAt: { type: 'date' },
              authorName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              authorAvatarUrl: { type: 'keyword' },
              productNames: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              productIds: { type: 'keyword' },
            },
          },
        },
      });

      serverLogger.info(`Created OpenSearch index: ${BLOGS_INDEX}`);
    } catch (error) {
      await this.disconnect();
      throw error;
    }
  }

  /**
   * Index a single blog document by ID (upsert).
   */
  public async indexBlogDocument(doc: BlogDocument): Promise<void> {
    const os = this.getClient();
    if (!os) return;

    await os.index({
      index: BLOGS_INDEX,
      id: doc.id,
      body: doc,
    });
  }

  /**
   * Delete a blog document from the index. Silently ignores 404.
   */
  public async deleteBlogDocument(id: string): Promise<void> {
    const os = this.getClient();
    if (!os) return;

    try {
      await os.delete({
        index: BLOGS_INDEX,
        id,
        refresh: 'wait_for',
      });
    } catch (error: unknown) {
      const statusCode = (error as { meta?: { statusCode?: number } })?.meta?.statusCode;
      if (statusCode !== 404) {
        throw error;
      }
    }
  }

  // ── Unified search ────────────────────────────

  /**
   * Full-text search across any configured index. The `target` param selects
   * the index, search fields, filters, and facet configuration.
   */
  public async search<T extends SearchHit = SearchHit>(params: SearchQueryParams): Promise<SearchResponse<T>> {
    const os = this.getClient();
    if (!os) {
      return { success: true, hits: [], total: 0, page: params.page, pageSize: params.limit, totalPages: 0, facets: {} };
    }

    const config = INDEX_CONFIGS[params.target];
    const from = (params.page - 1) * params.limit;

    const must = [
      {
        multi_match: {
          query: params.q,
          fields: config.fields,
          fuzziness: 'AUTO' as const,
          type: 'best_fields' as const,
        },
      },
    ];

    const filter: { term: Record<string, string> }[] = [{ term: { status: 'published' } }];
    for (const key of config.filterKeys) {
      const value = params[key as keyof SearchQueryParams] as string | undefined;
      if (value) {
        filter.push({ term: { [key]: value } });
      }
    }

    const aggs: Record<string, AggregationContainer> = {};
    for (const [name, facetConfig] of Object.entries(config.facets)) {
      aggs[name] = facetConfig.agg;
    }

    const body = {
      query: {
        bool: { must, filter },
      },
      highlight: {
        pre_tags: ['<mark>'],
        post_tags: ['</mark>'],
        fields: {
          title: { number_of_fragments: 1 },
          description: { number_of_fragments: 3, fragment_size: 150 },
        },
      },
      aggs,
      from,
      size: params.limit,
      sort: [{ _score: { order: 'desc' as const } }, { publishedAt: { order: 'desc' as const } }],
    };

    const response = await os.search({ index: config.index, body });

    const hitsObj = response.body.hits;
    const total = typeof hitsObj.total === 'number' ? hitsObj.total : (hitsObj.total as { value: number }).value;

    const hits = hitsObj.hits.map((hit) => {
      const source = hit._source as ChangelogDocument | BlogDocument;
      const highlight = hit.highlight || {};
      return {
        ...source,
        score: hit._score as number,
        highlights: {
          title: highlight['title'] || undefined,
          description: highlight['description'] || undefined,
        },
      } as T;
    });

    const responseAggs = response.body.aggregations || {};
    const facets: Record<string, FacetBucket[]> = {};
    for (const [name, facetConfig] of Object.entries(config.facets)) {
      const buckets = (responseAggs[name] as { buckets?: OpenSearchAggBucket[] })?.buckets || [];
      facets[name] = buckets.map(facetConfig.extractBucket);
    }

    return {
      success: true,
      hits,
      total,
      page: params.page,
      pageSize: params.limit,
      totalPages: Math.ceil(total / params.limit),
      facets,
    };
  }

  // ── Reindex operations ────────────────────────

  public async reindexAll(): Promise<{ indexed: number; errors: number }> {
    const os = this.getClient();
    if (!os) {
      return { indexed: 0, errors: 0 };
    }

    // Delete and recreate the index
    try {
      await os.indices.delete({ index: CHANGELOGS_INDEX });
    } catch {
      // Index may not exist
    }

    await this.ensureIndex();

    // Bulk index all published entries
    const prisma = getPrismaClient();
    let indexed = 0;
    let errors = 0;
    let skip = 0;

    while (true) {
      const entries = await prisma.changelogEntry.findMany({
        where: { status: 'published' },
        include: { product: true },
        orderBy: { publishedAt: 'desc' },
        skip,
        take: BULK_BATCH_SIZE,
      });

      if (entries.length === 0) break;

      const bulkBody: (OpenSearchBulkAction | ChangelogDocument)[] = [];
      for (const entry of entries) {
        if (!entry.product) continue;
        const doc: ChangelogDocument = {
          id: entry.id,
          slug: entry.slug,
          title: entry.title,
          description: entry.description,
          version: entry.version,
          status: entry.status,
          publishedAt: entry.publishedAt?.toISOString() ?? null,
          createdAt: entry.createdAt.toISOString(),
          productId: entry.productId,
          productName: entry.product.name,
          productSlug: entry.product.slug,
          productFaIcon: entry.product.faIcon,
        };
        bulkBody.push({ index: { _index: CHANGELOGS_INDEX, _id: doc.id } });
        bulkBody.push(doc);
      }

      if (bulkBody.length > 0) {
        const bulkResult = await os.bulk({ body: bulkBody, refresh: 'wait_for' });
        const bulkResponse = bulkResult.body as OpenSearchBulkResponse;
        if (bulkResponse.errors) {
          for (const item of bulkResponse.items) {
            const action = item.index || item.create;
            if (action?.error) {
              errors++;
              serverLogger.warn({ error: action.error, id: action._id }, 'Failed to index changelog entry during reindex');
            } else {
              indexed++;
            }
          }
        } else {
          indexed += bulkResponse.items.length;
        }
      }

      skip += entries.length;
      serverLogger.info({ indexed, errors, batch: skip }, 'Reindex progress');
    }

    serverLogger.info({ indexed, errors }, 'Reindex completed');
    return { indexed, errors };
  }

  public async reindexAllBlogs(): Promise<{ indexed: number; errors: number }> {
    const os = this.getClient();
    if (!os) {
      return { indexed: 0, errors: 0 };
    }

    try {
      await os.indices.delete({ index: BLOGS_INDEX });
    } catch {
      // Index may not exist
    }

    await this.ensureBlogsIndex();

    const prisma = getPrismaClient();
    let indexed = 0;
    let errors = 0;
    let skip = 0;

    while (true) {
      const blogs = await prisma.blog.findMany({
        where: { status: 'published' },
        include: {
          author: { select: { name: true, avatarUrl: true } },
          products: { include: { product: { select: { id: true, name: true } } } },
        },
        orderBy: { publishedAt: 'desc' },
        skip,
        take: BULK_BATCH_SIZE,
      });

      if (blogs.length === 0) break;

      const bulkBody: (OpenSearchBulkAction | BlogDocument)[] = [];
      for (const blog of blogs) {
        const doc = toBlogDocument(blog);
        bulkBody.push({ index: { _index: BLOGS_INDEX, _id: doc.id } });
        bulkBody.push(doc);
      }

      if (bulkBody.length > 0) {
        const bulkResult = await os.bulk({ body: bulkBody, refresh: 'wait_for' });
        const bulkResponse = bulkResult.body as OpenSearchBulkResponse;
        if (bulkResponse.errors) {
          for (const item of bulkResponse.items) {
            const action = item.index || item.create;
            if (action?.error) {
              errors++;
              serverLogger.warn({ error: action.error, id: action._id }, 'Failed to index blog during reindex');
            } else {
              indexed++;
            }
          }
        } else {
          indexed += bulkResponse.items.length;
        }
      }

      skip += blogs.length;
      serverLogger.info({ indexed, errors, batch: skip }, 'Blog reindex progress');
    }

    serverLogger.info({ indexed, errors }, 'Blog reindex completed');
    return { indexed, errors };
  }
}
