// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import crypto from 'node:crypto';

import { ServiceUnavailableError } from '../errors';
import { markdownToSlackMrkdwn } from '../helpers/markdown-to-slack-mrkdwn';
import { serverLogger } from '../server-logger';
import { getPrismaClient } from './prisma.service';

import type { PostChangelogEntry, PostToSlackResponse, SlackApiResponse, SlackBlock } from '@lfx-changelog/shared';
import type { SlackChannel as PrismaSlackChannel, SlackIntegration as PrismaSlackIntegration } from '@prisma/client';

export class SlackService {
  private get slackClientId(): string {
    return process.env['SLACK_CLIENT_ID'] || '';
  }

  private get slackClientSecret(): string {
    return process.env['SLACK_CLIENT_SECRET'] || '';
  }

  private get encryptionKeyHex(): string {
    return process.env['SLACK_TOKEN_ENCRYPTION_KEY'] || '';
  }

  private get webhookStateSecret(): string {
    const secret = process.env['WEBHOOK_STATE_SECRET'];
    if (!secret) {
      throw new ServiceUnavailableError('WEBHOOK_STATE_SECRET must be set for OAuth state signing', {
        operation: 'webhookStateSecret',
        service: 'slack',
      });
    }
    return secret;
  }

  private get baseUrl(): string {
    return process.env['BASE_URL'] || 'http://localhost:4204';
  }
  private readonly slackUserScopes = 'chat:write,channels:read,groups:read';
  private readonly tokenRefreshBufferMs = 5 * 60 * 1000; // Refresh 5 minutes before expiry
  private readonly stateTtlMs = 10 * 60 * 1000; // OAuth state expires after 10 minutes

  /**
   * Generate the Slack OAuth URL for the user to authorize.
   */
  public getOAuthUrl(userId: string): string {
    if (!this.slackClientId || !this.slackClientSecret) {
      throw new ServiceUnavailableError('Slack OAuth is not configured — SLACK_CLIENT_ID and SLACK_CLIENT_SECRET must be set', {
        operation: 'getOAuthUrl',
        service: 'slack',
      });
    }
    const state = this.signState({ userId, ts: Date.now() });
    const redirectUri = `${this.baseUrl}/webhooks/slack-callback`;
    const params = new URLSearchParams({
      client_id: this.slackClientId,
      user_scope: this.slackUserScopes,
      redirect_uri: redirectUri,
      state,
    });
    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  /**
   * Handle the OAuth callback: exchange code for tokens, store encrypted in DB.
   */
  public async handleOAuthCallback(code: string, state: string): Promise<{ userId: string; integrationId: string }> {
    const statePayload = this.verifyState(state);
    if (!statePayload || !statePayload['userId']) {
      throw new Error('Invalid or expired OAuth state');
    }
    const userId = statePayload['userId'] as string;

    const redirectUri = `${this.baseUrl}/webhooks/slack-callback`;
    const tokenResponse = await this.slackApiFetch('https://slack.com/api/oauth.v2.access', {
      client_id: this.slackClientId,
      client_secret: this.slackClientSecret,
      code,
      redirect_uri: redirectUri,
    });

    if (!tokenResponse.ok) {
      serverLogger.error({ error: tokenResponse.error }, 'Slack OAuth token exchange failed');
      throw new Error(`Slack OAuth failed: ${tokenResponse.error}`);
    }

    const authedUser = tokenResponse['authed_user'] as {
      id: string;
      access_token: string;
      refresh_token: string;
      expires_in: number;
      scope: string;
    };
    const team = tokenResponse['team'] as { id: string; name: string };

    if (!authedUser?.access_token || !authedUser?.refresh_token) {
      throw new Error('Slack OAuth response missing user tokens — ensure token rotation is enabled');
    }

    const encryptedAccessToken = this.encrypt(authedUser.access_token);
    const encryptedRefreshToken = this.encrypt(authedUser.refresh_token);
    const tokenExpiresAt = new Date(Date.now() + authedUser.expires_in * 1000);

    const prisma = getPrismaClient();
    const integration = await prisma.slackIntegration.upsert({
      where: { userId_teamId: { userId, teamId: team.id } },
      create: {
        userId,
        teamId: team.id,
        teamName: team.name,
        slackUserId: authedUser.id,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt,
        scope: authedUser.scope,
        status: 'active',
      },
      update: {
        teamName: team.name,
        slackUserId: authedUser.id,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt,
        scope: authedUser.scope,
        status: 'active',
      },
    });

    serverLogger.info({ userId, teamId: team.id, teamName: team.name }, 'Slack integration connected');
    return { userId, integrationId: integration.id };
  }

  /**
   * Get all integrations for a user (with channels).
   */
  public async getIntegrations(userId: string): Promise<(PrismaSlackIntegration & { channels: PrismaSlackChannel[] })[]> {
    const prisma = getPrismaClient();
    return prisma.slackIntegration.findMany({
      where: { userId },
      include: { channels: true },
      orderBy: { connectedAt: 'desc' },
    });
  }

  /**
   * Get channels from the user's Slack workspace.
   * Uses the user token so only channels the user can access are returned.
   * Paginates up to 10 pages (999 per page) to cover large workspaces.
   */
  public async getChannels(userId: string, integrationId: string): Promise<{ id: string; name: string; isPrivate: boolean }[]> {
    const prisma = getPrismaClient();
    const integration = await prisma.slackIntegration.findFirst({ where: { id: integrationId, userId } });
    if (!integration) {
      throw new Error('Slack integration not found');
    }

    const token = await this.getFreshToken(integrationId);
    const maxPages = 10;
    const channels: { id: string; name: string; isPrivate: boolean }[] = [];
    let cursor: string | undefined;
    let page = 0;

    serverLogger.info({ integrationId }, 'Fetching Slack channels');

    do {
      const url = new URL('https://slack.com/api/conversations.list');
      url.searchParams.set('types', 'public_channel,private_channel');
      url.searchParams.set('exclude_archived', 'true');
      url.searchParams.set('limit', '999');
      if (cursor) url.searchParams.set('cursor', cursor);

      const res = await this.slackApiGet(url.toString(), token);

      if (!res.ok) {
        await this.handleSlackError(integrationId, res.error);
        throw new Error(`Slack API error: ${res.error}`);
      }

      const channelList = (res['channels'] as { id: string; name: string; is_private: boolean }[]) || [];
      for (const ch of channelList) {
        channels.push({ id: ch.id, name: ch.name, isPrivate: ch.is_private });
      }

      cursor = (res['response_metadata'] as { next_cursor?: string })?.next_cursor || undefined;
      page++;
    } while (cursor && page < maxPages);

    serverLogger.info({ total: channels.length, pages: page, hasMore: !!cursor }, 'Slack channels fetched');

    return channels;
  }

  /**
   * Save a channel as the default for an integration.
   */
  public async saveChannel(userId: string, integrationId: string, channelId: string, channelName: string): Promise<PrismaSlackChannel> {
    const prisma = getPrismaClient();
    const integration = await prisma.slackIntegration.findFirst({ where: { id: integrationId, userId } });
    if (!integration) {
      throw new Error('Slack integration not found');
    }

    await prisma.slackChannel.updateMany({
      where: { slackIntegrationId: integrationId, isDefault: true },
      data: { isDefault: false },
    });

    return prisma.slackChannel.upsert({
      where: { slackIntegrationId_channelId: { slackIntegrationId: integrationId, channelId } },
      create: {
        slackIntegrationId: integrationId,
        channelId,
        channelName,
        isDefault: true,
      },
      update: {
        channelName,
        isDefault: true,
      },
    });
  }

  /**
   * Post a changelog entry to Slack as the user.
   */
  public async postChangelog(userId: string, channelId: string, channelName: string, changelogEntry: PostChangelogEntry): Promise<PostToSlackResponse> {
    const prisma = getPrismaClient();

    // Find the user's active integration directly (no saved SlackChannel row required)
    const integration = await prisma.slackIntegration.findFirst({
      where: { userId, status: 'active' },
    });
    if (!integration) {
      throw new Error('No active Slack integration found — please connect Slack in Settings');
    }

    // Upsert a SlackChannel row so we can track notifications
    const slackChannel = await prisma.slackChannel.upsert({
      where: { slackIntegrationId_channelId: { slackIntegrationId: integration.id, channelId } },
      create: { slackIntegrationId: integration.id, channelId, channelName, isDefault: false },
      update: { channelName },
    });

    const token = await this.getFreshToken(integration.id);
    const entryUrl = `${this.baseUrl}/entry/${changelogEntry.slug || changelogEntry.id}`;
    const slackDescription = markdownToSlackMrkdwn(changelogEntry.description);
    const descriptionPreview = slackDescription.length > 500 ? `${slackDescription.slice(0, 497)}...` : slackDescription;

    const blocks = this.buildBlockKitMessage(changelogEntry, descriptionPreview, entryUrl);

    const res = await this.slackApiPost('https://slack.com/api/chat.postMessage', token, {
      channel: channelId,
      blocks,
      text: `New Changelog: ${changelogEntry.title}`,
    });

    if (!res.ok) {
      await prisma.slackNotification.upsert({
        where: { slackChannelId_changelogEntryId: { slackChannelId: slackChannel.id, changelogEntryId: changelogEntry.id } },
        create: {
          slackChannelId: slackChannel.id,
          changelogEntryId: changelogEntry.id,
          status: 'failed',
          errorMessage: res.error || 'Unknown error',
          sentAt: new Date(),
        },
        update: {
          status: 'failed',
          errorMessage: res.error || 'Unknown error',
          sentAt: new Date(),
        },
      });

      await this.handleSlackError(integration.id, res.error);
      throw new Error(`Failed to post to Slack: ${res.error}`);
    }

    const messageTs = res['ts'] as string;

    await prisma.slackNotification.upsert({
      where: { slackChannelId_changelogEntryId: { slackChannelId: slackChannel.id, changelogEntryId: changelogEntry.id } },
      create: {
        slackChannelId: slackChannel.id,
        changelogEntryId: changelogEntry.id,
        messageTs,
        status: 'sent',
        sentAt: new Date(),
      },
      update: {
        messageTs,
        status: 'sent',
        errorMessage: null,
        sentAt: new Date(),
      },
    });

    serverLogger.info({ changelogId: changelogEntry.id, channelId, messageTs }, 'Changelog posted to Slack');
    return { messageTs, channelName: slackChannel.channelName };
  }

  /**
   * Disconnect a Slack integration: revoke the token and delete DB records.
   */
  public async disconnect(userId: string, integrationId: string): Promise<void> {
    const prisma = getPrismaClient();
    const integration = await prisma.slackIntegration.findFirst({
      where: { id: integrationId, userId },
    });

    if (!integration) {
      throw new Error('Slack integration not found');
    }

    try {
      const token = this.decrypt(integration.accessToken);
      await this.slackApiFetch('https://slack.com/api/auth.revoke', { token });
    } catch (err) {
      serverLogger.warn({ err, integrationId }, 'Failed to revoke Slack token — deleting integration anyway');
    }

    await prisma.slackIntegration.delete({ where: { id: integrationId } });
    serverLogger.info({ userId, integrationId }, 'Slack integration disconnected');
  }

  // ── Token refresh ─────────────────────────────────────────────────────────

  private async getFreshToken(integrationId: string): Promise<string> {
    const prisma = getPrismaClient();
    const integration = await prisma.slackIntegration.findUniqueOrThrow({ where: { id: integrationId } });

    if (integration.status !== 'active') {
      throw new Error('Slack integration is not active — please reconnect');
    }

    const now = Date.now();
    const expiresAt = integration.tokenExpiresAt.getTime();

    if (expiresAt - now > this.tokenRefreshBufferMs) {
      return this.decrypt(integration.accessToken);
    }

    serverLogger.info({ integrationId }, 'Refreshing Slack access token');
    const refreshToken = this.decrypt(integration.refreshToken);

    const res = await this.slackApiFetch('https://slack.com/api/oauth.v2.access', {
      client_id: this.slackClientId,
      client_secret: this.slackClientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    if (!res.ok) {
      serverLogger.error({ error: res.error, integrationId }, 'Slack token refresh failed');
      if (res.error === 'invalid_refresh_token' || res.error === 'token_revoked' || res.error === 'invalid_auth') {
        await prisma.slackIntegration.update({
          where: { id: integrationId },
          data: { status: 'revoked' },
        });
      }
      throw new Error(`Slack token refresh failed: ${res.error}`);
    }

    const newAccessToken = res['access_token'] as string;
    const newRefreshToken = res['refresh_token'] as string;
    const expiresIn = res['expires_in'] as number;

    await prisma.slackIntegration.update({
      where: { id: integrationId },
      data: {
        accessToken: this.encrypt(newAccessToken),
        refreshToken: this.encrypt(newRefreshToken),
        tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
      },
    });

    return newAccessToken;
  }

  // ── Slack error handling ──────────────────────────────────────────────────

  private async handleSlackError(integrationId: string, error?: string): Promise<void> {
    if (error === 'token_revoked' || error === 'invalid_auth' || error === 'account_inactive') {
      const prisma = getPrismaClient();
      await prisma.slackIntegration.update({
        where: { id: integrationId },
        data: { status: 'revoked' },
      });
      serverLogger.warn({ integrationId, error }, 'Slack integration marked as revoked');
    }
  }

  // ── Block Kit message ─────────────────────────────────────────────────────

  private buildBlockKitMessage(
    entry: Pick<PostChangelogEntry, 'title' | 'version' | 'product' | 'author'>,
    descriptionPreview: string,
    entryUrl: string
  ): SlackBlock[] {
    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: `New Changelog: ${entry.title}`, emoji: true },
      },
    ];

    const fields: { type: string; text: string }[] = [];
    if (entry.product?.name) {
      fields.push({ type: 'mrkdwn', text: `*Product:*\n${entry.product.name}` });
    }
    if (entry.version) {
      fields.push({ type: 'mrkdwn', text: `*Version:*\n${entry.version}` });
    }
    if (fields.length > 0) {
      blocks.push({ type: 'section', fields });
    }

    if (descriptionPreview) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: descriptionPreview },
      });
    }

    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View Full Changelog', emoji: true },
          url: entryUrl,
        },
      ],
    });

    const contextText = entry.author?.name ? `Posted by *${entry.author.name}* via LFX Changelog` : 'Posted via LFX Changelog';
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: contextText }],
    });

    return blocks;
  }

  // ── Token encryption (AES-256-GCM) ────────────────────────────────────────

  private getEncryptionKey(): Buffer {
    if (this.encryptionKeyHex.length !== 64) {
      throw new Error('SLACK_TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
    }
    return Buffer.from(this.encryptionKeyHex, 'hex');
  }

  private encrypt(plaintext: string): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64url')}:${authTag.toString('base64url')}:${encrypted.toString('base64url')}`;
  }

  private decrypt(token: string): string {
    const key = this.getEncryptionKey();
    const [ivB64, tagB64, dataB64] = token.split(':');
    if (!ivB64 || !tagB64 || !dataB64) {
      throw new Error('Invalid encrypted token format');
    }
    const iv = Buffer.from(ivB64, 'base64url');
    const authTag = Buffer.from(tagB64, 'base64url');
    const encrypted = Buffer.from(dataB64, 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final('utf8');
  }

  // ── Signed state (CSRF protection) ────────────────────────────────────────

  private signState(payload: Record<string, unknown>): string {
    const data = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', this.webhookStateSecret).update(data).digest('hex');
    return Buffer.from(JSON.stringify({ d: data, s: hmac })).toString('base64url');
  }

  private verifyState(state: string): Record<string, unknown> | null {
    try {
      const outer = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8')) as { d: string; s: string };
      if (!outer.d || !outer.s) return null;
      const expectedHmac = crypto.createHmac('sha256', this.webhookStateSecret).update(outer.d).digest('hex');
      if (!crypto.timingSafeEqual(Buffer.from(outer.s, 'hex'), Buffer.from(expectedHmac, 'hex'))) {
        return null;
      }
      const payload = JSON.parse(outer.d) as Record<string, unknown>;

      // Reject expired states
      const ts = payload['ts'] as number | undefined;
      if (ts && Date.now() - ts > this.stateTtlMs) {
        serverLogger.warn({ ts, ageMs: Date.now() - ts }, 'OAuth state expired');
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  // ── Slack API helpers ─────────────────────────────────────────────────────

  private async slackApiFetch(url: string, body: Record<string, string>): Promise<SlackApiResponse> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body).toString(),
    });
    return (await res.json()) as SlackApiResponse;
  }

  private async slackApiGet(url: string, token: string, retries = 3): Promise<SlackApiResponse> {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as SlackApiResponse;

    if (body.error === 'ratelimited' && retries > 0) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10);
      serverLogger.warn({ url, retryAfter, retriesLeft: retries - 1 }, 'Slack API rate limited, retrying');
      await this.sleep(retryAfter * 1000);
      return this.slackApiGet(url, token, retries - 1);
    }

    return body;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async slackApiPost(url: string, token: string, body: Record<string, unknown>): Promise<SlackApiResponse> {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return (await res.json()) as SlackApiResponse;
  }
}
