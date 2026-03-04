// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { CHANGELOGS_INDEX } from '@lfx-changelog/shared';
import { Client } from '@opensearch-project/opensearch';

import { serverLogger } from '../server-logger';

import type { ChangelogDocument } from '@lfx-changelog/shared';

export class OpenSearchService {
  private client: Client | null = null;

  /**
   * Returns the OpenSearch client singleton. Returns `null` if OPENSEARCH_URL is not set,
   * allowing the app to degrade gracefully without search.
   */
  public getClient(): Client | null {
    const url = process.env['OPENSEARCH_URL'];
    if (!url) {
      return null;
    }

    if (!this.client) {
      this.client = new Client({ node: url });
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
    return this.client;
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
      // Reset client so the connection pool doesn't retain dead nodes.
      // This allows subsequent requests to establish a fresh connection
      // (e.g. when OpenSearch becomes available after server startup).
      await this.disconnect();
      throw error;
    }
  }

  /**
   * Index a single changelog document by ID (upsert).
   */
  public async index(doc: ChangelogDocument): Promise<void> {
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
   * Uses `refresh: 'wait_for'` (unlike index) so the deletion is
   * immediately visible — prevents stale results showing deleted content in search.
   */
  public async delete(id: string): Promise<void> {
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
    if (this.client) {
      await this.client.close();
      this.client = null;
      serverLogger.info('OpenSearch client disconnected');
    }
  }
}

// ── Singleton accessor ────────────────────────────────────────────────────
let instance: OpenSearchService | null = null;

export function getOpenSearchService(): OpenSearchService {
  if (!instance) instance = new OpenSearchService();
  return instance;
}
