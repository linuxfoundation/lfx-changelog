// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { ChangelogApiResponse } from './types.js';

const DEFAULT_BASE_URL = 'https://changelog.lfx.dev';

export async function fetchChangelogs(
  productSlug: string,
  limit: number,
  baseUrl: string = DEFAULT_BASE_URL,
  signal?: AbortSignal
): Promise<ChangelogApiResponse> {
  const url = new URL('/public/api/changelogs', baseUrl);
  url.searchParams.set('productSlug', productSlug);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('page', '1');

  const response = await fetch(url.toString(), {
    signal,
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch changelogs: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
