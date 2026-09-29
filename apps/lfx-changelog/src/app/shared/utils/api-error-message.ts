// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { HttpErrorResponse } from '@angular/common/http';
import { ApiErrorResponseSchema } from '@lfx-changelog/shared';

export function apiErrorMessage(err: unknown, fallback: string): string {
  const body = err instanceof HttpErrorResponse ? err.error : undefined;
  return ApiErrorResponseSchema.safeParse(body).data?.error ?? fallback;
}
