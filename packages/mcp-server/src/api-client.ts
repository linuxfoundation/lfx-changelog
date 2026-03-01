// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

/**
 * Thin HTTP client for the LFX Changelog API.
 * Constructor accepts a `baseUrl` and optional `apiKey` parameter.
 * When an API key is provided (or set via LFX_API_KEY env var), it is
 * attached as a Bearer token for authenticated requests to `/api/*` endpoints.
 */
export class ApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;

  public constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey || process.env['LFX_API_KEY'];
  }

  public get isAuthenticated(): boolean {
    return !!this.apiKey;
  }

  public async get<T = unknown>(path: string, query?: Record<string, string>): Promise<T> {
    return this.request<T>('GET', path, undefined, query);
  }

  public async post<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  public async put<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  public async patch<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  public async delete(path: string): Promise<void> {
    await this.request('DELETE', path);
  }

  private async request<T = unknown>(method: string, path: string, body?: unknown, query?: Record<string, string>): Promise<T> {
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

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const responseBody = await response.text().catch(() => 'No response body');
      throw new Error(`API request failed: ${response.status} ${response.statusText} — ${responseBody}`);
    }

    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }
}
