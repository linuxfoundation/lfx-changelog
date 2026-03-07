// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { EventEmitter } from 'events';

import type { AgentJobSSEEvent } from '@lfx-changelog/shared';

class AgentJobEmitter {
  private readonly emitter = new EventEmitter();

  public constructor() {
    this.emitter.setMaxListeners(100);
  }

  public emit(jobId: string, event: AgentJobSSEEvent): void {
    this.emitter.emit(jobId, event);
  }

  public subscribe(jobId: string, listener: (event: AgentJobSSEEvent) => void): void {
    this.emitter.on(jobId, listener);
  }

  public unsubscribe(jobId: string, listener: (event: AgentJobSSEEvent) => void): void {
    this.emitter.off(jobId, listener);
  }

  public removeAllForJob(jobId: string): void {
    this.emitter.removeAllListeners(jobId);
  }
}

export const agentJobEmitter = new AgentJobEmitter();
