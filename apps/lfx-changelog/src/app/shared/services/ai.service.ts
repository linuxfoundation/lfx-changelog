// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { inject, Injectable, signal } from '@angular/core';
import { Subscription } from 'rxjs';

import { SseService } from './sse.service';

import type { ChangelogGenerationState, ChangelogSSEEvent, ChangelogSSEEventType, GenerateChangelogRequest } from '@lfx-changelog/shared';

const INITIAL_STATE: ChangelogGenerationState = {
  generating: false,
  status: '',
  title: '',
  slug: '',
  version: '',
  description: '',
  error: '',
  done: false,
};

@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly sseService = inject(SseService);

  public readonly state = signal<ChangelogGenerationState>({ ...INITIAL_STATE });

  private subscription: Subscription | null = null;

  public generateChangelog(request: GenerateChangelogRequest): void {
    this.reset();
    this.state.set({ ...INITIAL_STATE, generating: true, status: 'Starting generation...' });

    this.subscription = this.sseService
      .connect<ChangelogSSEEventType>('/api/ai/generate-changelog', { method: 'POST', body: request })
      .subscribe({
        next: (event) => this.handleSSEEvent(event as ChangelogSSEEvent),
        error: (err) => {
          this.state.update((s) => ({
            ...s,
            generating: false,
            error: `Connection error: ${err instanceof Error ? err.message : 'Unknown error'}`,
          }));
        },
        complete: () => {
          this.state.update((s) => {
            if (!s.done && !s.error) {
              return { ...s, generating: false, done: true };
            }
            return { ...s, generating: false };
          });
        },
      });
  }

  public abort(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
    this.state.update((s) => ({ ...s, generating: false, status: '', error: s.done ? '' : 'Generation cancelled.' }));
  }

  public reset(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
    this.state.set({ ...INITIAL_STATE });
  }

  private handleSSEEvent(event: ChangelogSSEEvent): void {
    switch (event.type) {
      case 'status':
        this.state.update((s) => ({ ...s, status: event.data }));
        break;
      case 'title':
        this.state.update((s) => ({ ...s, title: event.data }));
        break;
      case 'slug':
        this.state.update((s) => ({ ...s, slug: event.data }));
        break;
      case 'version':
        this.state.update((s) => ({ ...s, version: event.data }));
        break;
      case 'content':
        this.state.update((s) => ({ ...s, description: s.description + event.data }));
        break;
      case 'done':
        this.state.update((s) => ({ ...s, generating: false, done: true, status: '' }));
        break;
      case 'error':
        this.state.update((s) => ({ ...s, generating: false, error: event.data }));
        break;
    }
  }
}
