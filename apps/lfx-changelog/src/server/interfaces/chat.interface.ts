// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { OpenAIToolCall } from '@lfx-changelog/shared';
import type { Response } from 'express';

/** Express Response extended by the compression middleware with a flush() method. */
export interface FlushableResponse extends Response {
  flush?: () => void;
}

/** Result of reading a single streaming response. */
export interface StreamResult {
  content: string;
  toolCalls: OpenAIToolCall[];
  finishReason: string | null;
}
