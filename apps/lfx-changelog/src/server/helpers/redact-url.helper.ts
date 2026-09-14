// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

/**
 * Query parameters whose values identify a person and must not reach the logs.
 * `query` carries contributor search terms, which are frequently email addresses.
 */
const REDACTED_QUERY_PARAMS = new Set(['query', 'email', 'q']);

/**
 * Lower-cased parameter name, falling back to the raw key when it is not valid percent-encoding.
 * decodeURIComponent throws URIError on input like `%zz`, and this helper runs inside the request
 * logger for every request — an exception here would take down logging across the whole API.
 */
function decodeKey(key: string | undefined): string {
  const raw = key ?? '';
  try {
    return decodeURIComponent(raw).toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

/** Replaces sensitive query-parameter values with [REDACTED], leaving the rest of the URL intact. */
export function redactUrl(rawUrl: string): string {
  const [path, queryString] = rawUrl.split('?');
  if (!queryString) return rawUrl;

  const redacted = queryString
    .split('&')
    .map((pair) => {
      const [key] = pair.split('=');
      return REDACTED_QUERY_PARAMS.has(decodeKey(key)) ? `${key}=[REDACTED]` : pair;
    })
    .join('&');

  return `${path}?${redacted}`;
}
