// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { serverLogger } from '../server-logger';
import { releaseSlackMapService } from './release-slack-map.service';

import type { SlackPostResult } from '../interfaces/release.interface';

const POST_MESSAGE_URL = 'https://slack.com/api/chat.postMessage';

export class ReleaseSlackService {
  public isConfigured(): boolean {
    return Boolean(this.token() && this.channel());
  }

  public async postStart(displayName: string, newTag: string, prCount: number): Promise<SlackPostResult> {
    return this.post(`${displayName} ${newTag} — starting release (${prCount} PR(s)).`);
  }

  public async postThread(threadTs: string, text: string): Promise<SlackPostResult> {
    return this.post(text, { threadTs });
  }

  public async postBroadcastSummary(threadTs: string, text: string): Promise<SlackPostResult> {
    const mapping = await releaseSlackMapService.load();
    const substituted = releaseSlackMapService.substitute(text, mapping);
    return this.post(substituted, { threadTs, replyBroadcast: true });
  }

  public buildSummary(input: {
    displayName: string;
    newTag: string;
    prCount: number;
    pendingLines: string;
    releaseUrl: string;
    ciStatus: string;
    ciRunUrl: string;
    ciLabel: string;
    argocdLine: string;
    syncLine: string;
  }): string {
    return (
      `*${input.displayName} ${input.newTag} - ${input.prCount} PR(s) automatically released*\n\n` +
      `${input.pendingLines}\n\n` +
      `*Release:* <${input.releaseUrl}|View ${input.newTag} on GitHub>\n` +
      `*${input.ciLabel}:* ${input.ciStatus} — <${input.ciRunUrl}|View CI run>\n` +
      `*ArgoCD PR:* ${input.argocdLine}\n` +
      `*Deploy sync:* ${input.syncLine}`
    );
  }

  private async post(text: string, options: { threadTs?: string; replyBroadcast?: boolean } = {}): Promise<SlackPostResult> {
    const token = this.token();
    const channel = this.channel();
    if (!token || !channel) {
      return { ok: false, error: 'Slack bot token or channel is not configured' };
    }

    const response = await fetch(POST_MESSAGE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel,
        text,
        unfurl_links: false,
        thread_ts: options.threadTs,
        reply_broadcast: options.replyBroadcast ?? false,
      }),
    });
    const data = (await response.json()) as { ok?: boolean; ts?: string; channel?: string; error?: string };
    if (!data.ok) {
      serverLogger.warn({ error: data.error }, 'Release Slack post failed');
      return { ok: false, error: data.error || 'slack_post_failed' };
    }
    return { ok: true, ts: data.ts, channel: data.channel || channel };
  }

  private token(): string {
    return process.env['RELEASE_SLACK_BOT_TOKEN'] || process.env['SLACK_BOT_TOKEN'] || '';
  }

  private channel(): string {
    return process.env['RELEASE_SLACK_CHANNEL'] || process.env['SLACK_CHANNEL_ID'] || 'lfx-one-app-dev';
  }
}

export const releaseSlackService = new ReleaseSlackService();
