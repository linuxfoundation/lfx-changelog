// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { serverLogger } from '../server-logger';

import type { SlackMapEntry, SlackPostResult } from '../interfaces/release.interface';

const POST_MESSAGE_URL = 'https://slack.com/api/chat.postMessage';

/**
 * Escape the three characters Slack mrkdwn treats as control syntax so
 * contributor-controlled strings (PR titles, GitHub usernames) cannot inject
 * `<!channel>`, `<@Uxxx>` mentions, or `<url|label>` links when the automated
 * summary posts. Order matters: `&` must be escaped first to avoid double-escaping
 * the substitutions that follow. See https://api.slack.com/reference/surfaces/formatting#escaping.
 */
export function escapeSlackMrkdwn(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Return a safe rendering of a GitHub username for a Slack message: a real
 * `<@SlackID>` mention when the user is in the contributor→Slack map, or the
 * escaped plain-text `@name` otherwise. Only the author field on each pending
 * PR line should flow through this helper; applying it to arbitrary message
 * text would let a PR title containing `@some-mapped-user` be silently converted
 * into a real Slack mention.
 */
export function slackAuthorMention(username: string, mapping: Map<string, SlackMapEntry>): string {
  const entry = mapping.get(username);
  if (entry) {
    return `<@${entry.slackId}>`;
  }
  return `@${escapeSlackMrkdwn(username)}`;
}

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

  /**
   * Post `text` as-is to a broadcast summary. Previously this method loaded the
   * contributor→Slack map and substituted `@username` occurrences across the
   * whole assembled message, which let a contributor-controlled PR title
   * containing `@some-mapped-user` be transformed into a real Slack mention.
   * Substitution now happens at the assembly site (via `slackAuthorMention`)
   * so only the intended author field is converted.
   */
  public async postBroadcastSummary(threadTs: string, text: string): Promise<SlackPostResult> {
    return this.post(text, { threadTs, replyBroadcast: true });
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

    try {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      serverLogger.warn({ err: error }, 'Release Slack post threw');
      return { ok: false, error: message };
    }
  }

  private token(): string {
    return process.env['RELEASE_SLACK_BOT_TOKEN'] || process.env['SLACK_BOT_TOKEN'] || '';
  }

  private channel(): string {
    return process.env['RELEASE_SLACK_CHANNEL'] || process.env['SLACK_CHANNEL_ID'] || 'lfx-one-app-dev';
  }
}

export const releaseSlackService = new ReleaseSlackService();
