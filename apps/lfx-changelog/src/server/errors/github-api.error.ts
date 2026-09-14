// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { BaseApiError } from './base-api.error';

const UPSTREAM_STATUS_MAP: Record<number, { status: number; code: string }> = {
  401: { status: 403, code: 'GITHUB_FORBIDDEN' },
  403: { status: 403, code: 'GITHUB_FORBIDDEN' },
  404: { status: 404, code: 'NOT_FOUND' },
  422: { status: 422, code: 'GITHUB_VALIDATION_FAILED' },
};

export class GitHubApiError extends BaseApiError {
  public readonly upstreamStatus: number;
  public readonly upstreamBody?: string;

  public constructor(
    message: string,
    upstreamStatus: number,
    upstreamBody?: string,
    options: {
      operation?: string;
      service?: string;
      path?: string;
    } = {}
  ) {
    const mapped = UPSTREAM_STATUS_MAP[upstreamStatus] ?? { status: 502, code: 'GITHUB_UNAVAILABLE' };

    super(message, mapped.status, mapped.code, {
      service: 'github',
      ...options,
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
