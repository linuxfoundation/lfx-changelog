// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Injectable, signal } from '@angular/core';

import type { ChangelogGenerationState, ChangelogSSEEvent, ChangelogSSEEventType, GenerateChangelogRequest } from '@lfx-changelog/shared';

const INITIAL_STATE: ChangelogGenerationState = {
  generating: false,
  status: '',
  title: '',
  version: '',
  description: '',
  error: '',
  done: false,
};

@Injectable({ providedIn: 'root' })
export class AiService {
  public readonly state = signal<ChangelogGenerationState>({ ...INITIAL_STATE });

  private abortController: AbortController | null = null;

  public generateChangelog(request: GenerateChangelogRequest): void {
    this.reset();
    this.state.set({ ...INITIAL_STATE, generating: true, status: 'Starting generation...' });

    this.abortController = new AbortController();
    this.streamGenerateChangelog(request, this.abortController.signal);
  }

  public abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.state.update((s) => ({ ...s, generating: false, status: '', error: s.done ? '' : 'Generation cancelled.' }));
  }

  public reset(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.state.set({ ...INITIAL_STATE });
  }

  private async streamGenerateChangelog(request: GenerateChangelogRequest, signal: AbortSignal): Promise<void> {
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

    try {
      const response = await fetch('/api/ai/generate-changelog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Request failed');
        this.state.update((s) => ({ ...s, generating: false, error: `Server error: ${errorText}` }));
        return;
      }

      if (!response.body) {
        this.state.update((s) => ({ ...s, generating: false, error: 'No response body received' }));
        return;
      }

      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = this.parseSSEBuffer(buffer);
        buffer = events.remaining;

        for (const event of events.parsed) {
          this.handleSSEEvent(event);
        }

        // Stop reading if we received a terminal event (error or done)
        const state = this.state();
        if (state.error || state.done) {
          void reader.cancel();
          return;
        }
      }

      // Handle any remaining buffer
      if (buffer.trim()) {
        const finalEvents = this.parseSSEBuffer(buffer + '\n\n');
        for (const event of finalEvents.parsed) {
          this.handleSSEEvent(event);
        }
      }

      this.state.update((s) => {
        if (!s.done && !s.error) {
          return { ...s, generating: false, done: true };
        }
        return { ...s, generating: false };
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      this.state.update((s) => ({
        ...s,
        generating: false,
        error: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }));
    } finally {
      if (reader) {
        void reader.cancel();
      }
    }
  }

  private handleSSEEvent(event: ChangelogSSEEvent): void {
    switch (event.type) {
      case 'status':
        this.state.update((s) => ({ ...s, status: event.data }));
        break;
      case 'title':
        this.state.update((s) => ({ ...s, title: event.data }));
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

  private parseSSEBuffer(buffer: string): { parsed: ChangelogSSEEvent[]; remaining: string } {
    const parsed: ChangelogSSEEvent[] = [];
    const blocks = buffer.split('\n\n');
    const remaining = blocks.pop() || '';

    for (const block of blocks) {
      if (!block.trim()) continue;

      let eventType: ChangelogSSEEventType = 'status';
      let data = '';

      for (const line of block.split('\n')) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim() as ChangelogSSEEventType;
        } else if (line.startsWith('data: ')) {
          const raw = line.slice(6);
          try {
            data = JSON.parse(raw) as string;
          } catch {
            data = raw;
          }
        }
      }

      if (data || eventType === 'done') {
        parsed.push({ type: eventType, data });
      }
    }

    return { parsed, remaining };
  }
}
