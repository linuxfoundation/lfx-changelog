// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { AgentMemoryData } from '../schemas/agent-memory.schema.js';

export const MAX_CORRECTIONS = 10;
export const MAX_QUALITY_SCORES = 20;

export const EMPTY_AGENT_MEMORY: AgentMemoryData = {
  stylePreferences: {
    headingStyle: null,
    bulletFormat: null,
    tone: null,
    detailLevel: null,
    wordCountRange: null,
    customInstructions: null,
  },
  recentCorrections: [],
  qualityScores: [],
  lastAnalyzedAt: null,
};
