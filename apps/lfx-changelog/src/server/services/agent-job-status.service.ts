// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { serverLogger } from '../server-logger';
import { getPrismaClient } from './prisma.service';

import type { AgentJobStatus, Prisma } from '@prisma/client';

/** The states a job can still be moved out of. Everything else is terminal. */
const ACTIVE_STATUSES: AgentJobStatus[] = ['pending', 'running'];

/**
 * Writes a terminal status, but only while the job is still active.
 *
 * Cancellation is the one terminal state set from outside the run, so a job that is cancelled
 * mid-flight goes on to finish its work and then reports the outcome. An unguarded write at that
 * point silently turns a cancelled job back into a completed one. Returns whether this call was
 * the one that ended the job, so callers can skip the log and SSE events when it was not.
 */
export async function finalizeAgentJob(jobId: string, data: Prisma.AgentJobUpdateManyMutationInput): Promise<boolean> {
  const prisma = getPrismaClient();

  const { count } = await prisma.agentJob.updateMany({
    where: { id: jobId, status: { in: ACTIVE_STATUSES } },
    data,
  });

  if (count === 0) {
    serverLogger.info({ jobId, status: data.status }, 'Agent job already finished — discarding late terminal update');
  }

  return count > 0;
}
