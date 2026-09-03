// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { PendingChange } from '@lfx-changelog/shared';

export interface FindAllPublicOptions {
  limit?: number;
  productId?: string;
}

export type DeploymentType = 'standalone' | 'platform-subchart';

export interface DeploymentConfig {
  type: DeploymentType;
  appName?: string;
  platformKey?: string;
}

export interface ReleasableServiceConfig {
  key: string;
  displayName: string;
  githubRepo: string;
  ciWorkflow: string;
  argocdRepo: string;
  environments: string[];
  aliases: string[];
  deployment: DeploymentConfig;
  releaseScript: string;
  argocdProductName?: string;
  ciSlackLabel: string;
  ciPlanNote?: string;
  showServiceInPlan: boolean;
}

export interface ServiceAudit {
  latestTag: string;
  publishedAt: string | null;
  pending: PendingChange[];
  error: string | null;
}

export interface SlackMapEntry {
  githubUsername: string;
  slackId: string;
  displayName: string;
}

export interface SlackPostResult {
  ok: boolean;
  ts?: string;
  channel?: string;
  error?: string;
}
