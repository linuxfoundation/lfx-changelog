// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

/**
 * Thin HTTP client for the LFX Changelog API.
 * Constructor accepts a `baseUrl` parameter — callers provide it from `BASE_URL` env var.
 * Phase 2: reads LFX_API_KEY for Bearer auth on protected endpoints.
 */
export class ApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;

  public constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = process.env['LFX_API_KEY'];
  }

  public async get<T = unknown>(path: string, query?: Record<string, string>): Promise<T> {
    const url = new URL(path, this.baseUrl);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== '') {
          url.searchParams.set(key, value);
        }
      }
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    // Phase 2: attach API key if configured
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      const body = await response.text().catch(() => 'No response body');
      throw new Error(`API request failed: ${response.status} ${response.statusText} — ${body}`);
    }

    return response.json() as Promise<T>;
  }
}
