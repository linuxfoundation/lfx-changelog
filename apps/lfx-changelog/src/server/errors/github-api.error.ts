// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { BaseApiError } from './base-api.error';

/** Stands in for a GitHub status when the call never produced one, e.g. a transport fault. */
export const NO_UPSTREAM_STATUS = 0;

const UPSTREAM_STATUS_MAP: Record<number, { status: number; code: string }> = {
  401: { status: 403, code: 'GITHUB_FORBIDDEN' },
  403: { status: 403, code: 'GITHUB_FORBIDDEN' },
  404: { status: 404, code: 'GITHUB_NOT_FOUND' },
  422: { status: 422, code: 'GITHUB_VALIDATION_FAILED' },
};

export class GitHubApiError extends BaseApiError {
  public readonly upstreamStatus: number;
  public readonly upstreamBody?: string;

  public constructor(
    message = 'GitHub API request failed',
    options: {
      upstreamStatus?: number;
      upstreamBody?: string;
      operation?: string;
      service?: string;
      path?: string;
    } = {}
  ) {
    const { upstreamStatus = NO_UPSTREAM_STATUS, upstreamBody, ...rest } = options;
    const mapped = UPSTREAM_STATUS_MAP[upstreamStatus] ?? { status: 502, code: 'GITHUB_SERVICE_ERROR' };

    super(message, mapped.status, mapped.code, {
      service: 'github',
      ...rest,
    });

    this.upstreamStatus = upstreamStatus;
    this.upstreamBody = upstreamBody?.slice(0, 500);
  }

  // GitHub's own error text stays out of `toResponse()` — it is untrusted upstream content,
  // and `BaseApiError` spreads `metadata` straight into the client response.
  public override getLogContext(): Record<string, any> {
    return {
      ...super.getLogContext(),
      upstream_status: this.upstreamStatus,
      upstream_body: this.upstreamBody,
    };
  }
}
