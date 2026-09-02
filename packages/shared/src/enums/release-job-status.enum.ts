// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

export enum ReleaseJobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  WAITING_FOR_APPROVAL = 'waiting_for_approval',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export const RELEASE_JOB_ACTIVE_STATUSES: readonly ReleaseJobStatus[] = [
  ReleaseJobStatus.PENDING,
  ReleaseJobStatus.RUNNING,
  ReleaseJobStatus.WAITING_FOR_APPROVAL,
];
