// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { serverLogger } from '../server-logger';

import { CHANGELOGS_INDEX, getOpenSearchClient, indexChangelog } from './opensearch.service';
import { getPrismaClient } from './prisma.service';

import type { SearchHit, SearchQueryParams, SearchResponse } from '@lfx-changelog/shared';
import type { ChangelogDocument } from './opensearch.service';

const BULK_BATCH_SIZE = 500;

export class SearchService {
  public async search(params: SearchQueryParams): Promise<SearchResponse> {
    const os = getOpenSearchClient();
    if (!os) {
      return { success: true, hits: [], total: 0, page: params.page, pageSize: params.limit, totalPages: 0, facets: { products: [] } };
    }

    const from = (params.page - 1) * params.limit;
    const must: Record<string, unknown>[] = [
      {
        multi_match: {
          query: params.q,
          fields: ['title^3', 'description', 'productName^2', 'version'],
          fuzziness: 'AUTO',
          type: 'best_fields',
        },
      },
    ];

    const filter: Record<string, unknown>[] = [{ term: { status: 'published' } }];
    if (params.productId) {
      filter.push({ term: { productId: params.productId } });
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
      aggs: {
        products: {
          terms: { field: 'productId', size: 50 },
          aggs: {
            product_name: { terms: { field: 'productName.keyword', size: 1 } },
          },
        },
      },
      from,
      size: params.limit,
      sort: [{ _score: { order: 'desc' as const } }, { publishedAt: { order: 'desc' as const } }],
    };

    const response = await os.search({ index: CHANGELOGS_INDEX, body });
    const result = response.body as Record<string, unknown>;
    const hitsObj = result['hits'] as { total: number | { value: number }; hits: Record<string, unknown>[] };

    const total = typeof hitsObj.total === 'number' ? hitsObj.total : hitsObj.total.value;
    const hits: SearchHit[] = hitsObj.hits.map((hit) => {
      const source = hit['_source'] as ChangelogDocument;
      const highlight = (hit['highlight'] || {}) as Record<string, string[]>;
      return {
        ...source,
        score: hit['_score'] as number,
        highlights: {
          title: highlight['title'] || undefined,
          description: highlight['description'] || undefined,
        },
      };
    });

    const aggs = (result['aggregations'] || {}) as Record<string, { buckets?: Record<string, unknown>[] }>;
    const productBuckets = aggs['products']?.buckets || [];
    const facets = {
      products: productBuckets.map((bucket) => {
        const subAgg = bucket['product_name'] as { buckets?: { key: string }[] } | undefined;
        return {
          productId: bucket['key'] as string,
          productName: subAgg?.buckets?.[0]?.key || 'Unknown',
          count: bucket['doc_count'] as number,
        };
      }),
    };

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

  public async reindexAll(): Promise<{ indexed: number; errors: number }> {
    const os = getOpenSearchClient();
    if (!os) {
      return { indexed: 0, errors: 0 };
    }

    // Delete and recreate the index
    try {
      await os.indices.delete({ index: CHANGELOGS_INDEX });
    } catch {
      // Index may not exist
    }

    // Re-import to create fresh index
    const { ensureChangelogsIndex } = await import('./opensearch.service');
    await ensureChangelogsIndex();

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

      for (const entry of entries) {
        if (!entry.product) continue;
        const doc: ChangelogDocument = {
          id: entry.id,
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

        try {
          await indexChangelog(doc);
          indexed++;
        } catch (err) {
          errors++;
          serverLogger.warn({ err, id: entry.id }, 'Failed to index changelog entry during reindex');
        }
      }

      skip += entries.length;
      serverLogger.info({ indexed, errors, batch: skip }, 'Reindex progress');
    }

    serverLogger.info({ indexed, errors }, 'Reindex completed');
    return { indexed, errors };
  }
}
