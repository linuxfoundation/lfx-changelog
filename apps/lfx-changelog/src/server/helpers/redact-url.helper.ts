// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

/**
 * Query parameters whose values identify a person and must not reach the logs.
 * `query` carries contributor search terms, which are frequently email addresses.
 */
const REDACTED_QUERY_PARAMS = new Set(['query', 'email', 'q']);

/** Replaces sensitive query-parameter values with [REDACTED], leaving the rest of the URL intact. */
export function redactUrl(rawUrl: string): string {
  const [path, queryString] = rawUrl.split('?');
  if (!queryString) return rawUrl;

  const redacted = queryString
    .split('&')
    .map((pair) => {
      const [key] = pair.split('=');
      return REDACTED_QUERY_PARAMS.has(decodeURIComponent(key ?? '').toLowerCase()) ? `${key}=[REDACTED]` : pair;
    })
    .join('&');

  return `${path}?${redacted}`;
}
