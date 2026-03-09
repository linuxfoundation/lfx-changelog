// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { ChatAccessLevel, OpenAIToolCall } from '@lfx-changelog/shared';
import type { Response } from 'express';

/** Express Response extended by the compression middleware with a flush() method. */
export interface FlushableResponse extends Response {
  flush?: () => void;
}

/** Authorization context threaded from controller → AI service → tool handlers. */
export type ChatCallerContext = {
  accessLevel: ChatAccessLevel;
  /** Product IDs the caller can see drafts for. undefined = super admin (no filter). */
  accessibleProductIds?: string[];
};

/** Result of reading a single streaming response. */
export interface StreamResult {
  content: string;
  toolCalls: OpenAIToolCall[];
  finishReason: string | null;
}
