// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { EventEmitter } from 'events';

import type { ReleaseJobSSEEvent } from '@lfx-changelog/shared';

class ReleaseJobEmitter {
  private readonly emitter = new EventEmitter();

  public constructor() {
    this.emitter.setMaxListeners(100);
  }

  public emit(jobId: string, event: ReleaseJobSSEEvent): void {
    this.emitter.emit(jobId, event);
  }

  public subscribe(jobId: string, listener: (event: ReleaseJobSSEEvent) => void): void {
    this.emitter.on(jobId, listener);
  }

  public unsubscribe(jobId: string, listener: (event: ReleaseJobSSEEvent) => void): void {
    this.emitter.off(jobId, listener);
  }

  public removeAllForJob(jobId: string): void {
    this.emitter.removeAllListeners(jobId);
  }
}

export const releaseJobEmitter = new ReleaseJobEmitter();
