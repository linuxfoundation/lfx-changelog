// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { CHANGELOGS_INDEX } from '@lfx-changelog/shared';
import { Client } from '@opensearch-project/opensearch';

import { serverLogger } from '../server-logger';

import type { ChangelogDocument } from '@lfx-changelog/shared';

let client: Client | null = null;

/**
 * Returns the OpenSearch client singleton. Returns `null` if OPENSEARCH_URL is not set,
 * allowing the app to degrade gracefully without search.
 */
export function getOpenSearchClient(): Client | null {
  const url = process.env['OPENSEARCH_URL'];
  if (!url) {
    return null;
  }

  if (!client) {
    client = new Client({ node: url });
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
  return client;
}

/**
 * Creates the changelogs index with the appropriate mapping if it doesn't exist.
 */
export async function ensureChangelogsIndex(): Promise<void> {
  const os = getOpenSearchClient();
  if (!os) {
    serverLogger.info('OpenSearch not configured — skipping index creation');
    return;
  }

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
}

/**
 * Index a single changelog document by ID (upsert).
 */
export async function indexChangelog(doc: ChangelogDocument): Promise<void> {
  const os = getOpenSearchClient();
  if (!os) return;

  await os.index({
    index: CHANGELOGS_INDEX,
    id: doc.id,
    body: doc,
  });
}

/**
 * Delete a changelog document from the index. Silently ignores 404.
 */
export async function deleteChangelogFromIndex(id: string): Promise<void> {
  const os = getOpenSearchClient();
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
export async function pingOpenSearch(): Promise<boolean> {
  const os = getOpenSearchClient();
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
export async function disconnectOpenSearch(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    serverLogger.info('OpenSearch client disconnected');
  }
}
