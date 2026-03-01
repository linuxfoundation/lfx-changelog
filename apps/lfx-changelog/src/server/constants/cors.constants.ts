// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

/** Allowed UI origins per deployed environment. */
const DEPLOYED_ORIGINS = ['https://changelog.dev.lfx.dev', 'https://changelog.lfx.dev'];

/**
 * Returns the appropriate CORS origin setting based on environment.
 * - Local dev: `*` (allow all origins)
 * - Deployed (dev/prod): only the known UI domains
 */
export function getCorsOrigins(): string | string[] {
  return process.env['NODE_ENV'] === 'production' ? DEPLOYED_ORIGINS : '*';
}
