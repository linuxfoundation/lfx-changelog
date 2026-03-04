// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { SlackIntegration } from '@lfx-changelog/shared';

export type SlackDialogState = {
  loading: boolean;
  integration: SlackIntegration | null;
};
