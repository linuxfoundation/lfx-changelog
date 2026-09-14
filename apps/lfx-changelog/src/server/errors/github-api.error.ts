// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { BaseApiError } from './base-api.error';

/**
 * A failed GitHub API call, mapped to a status the caller can act on.
 *
 * Release creation fails for reasons the user causes — a tag that already exists, an unknown
 * branch, an App without write permission — so these must not collapse into a generic 500.
 */
export class GitHubApiError extends BaseApiError {
  public readonly upstreamStatus: number;

  public constructor(message: string, upstreamStatus: number, upstreamBody?: string, options: { operation?: string; service?: string } = {}) {
    super(message, GitHubApiError.mapStatus(upstreamStatus), GitHubApiError.mapCode(upstreamStatus), {
      ...options,
      service: options.service ?? 'github',
      metadata: { upstreamStatus, upstreamBody: upstreamBody?.slice(0, 500) },
    });
    this.upstreamStatus = upstreamStatus;
  }

  /**
   * 422 is GitHub's validation failure and in practice means the tag already exists, so it
   * reads as a conflict. Anything unrecognised is an upstream fault, not a client error.
   */
  private static mapStatus(upstreamStatus: number): number {
    if (upstreamStatus === 422) return 409;
    if (upstreamStatus === 404) return 404;
    if (upstreamStatus === 403 || upstreamStatus === 401) return 403;
    return 502;
  }

  private static mapCode(upstreamStatus: number): string {
    if (upstreamStatus === 422) return 'CONFLICT';
    if (upstreamStatus === 404) return 'NOT_FOUND';
    if (upstreamStatus === 403 || upstreamStatus === 401) return 'GITHUB_FORBIDDEN';
    return 'GITHUB_UNAVAILABLE';
  }
}
