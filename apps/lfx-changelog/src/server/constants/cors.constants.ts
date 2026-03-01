// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

/**
 * Returns the appropriate CORS origin setting based on environment.
 * - Local dev: `*` (allow all origins for public API convenience)
 * - Deployed (dev/prod): only the BASE_URL origin
 */
export function getCorsOrigins(): string | string[] {
  const baseUrl = process.env['BASE_URL'];
  if (baseUrl) {
    return [baseUrl.replace(/\/+$/, '')];
  }

  return '*';
}
