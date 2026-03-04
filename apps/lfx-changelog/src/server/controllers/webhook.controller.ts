// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Request, Response } from 'express';
import crypto from 'node:crypto';

import { serverLogger } from '../server-logger';
import { AiService } from '../services/ai.service';
import { ChangelogService } from '../services/changelog.service';
import { GitHubService } from '../services/github.service';
import { getPrismaClient } from '../services/prisma.service';
import { ReleaseService } from '../services/release.service';
import { SlackService } from '../services/slack.service';

import { BOT_EMAIL, BOT_NAME, DEFAULT_LOOKBACK_DAYS, STALE_LOCK_MS } from '@lfx-changelog/shared';

import type { GitHubCommit, GitHubPullRequest, GitHubWebhookReleasePayload } from '@lfx-changelog/shared';

const WEBHOOK_STATE_SECRET = process.env['WEBHOOK_STATE_SECRET'] || '';

export class WebhookController {
  private readonly releaseService = new ReleaseService();
  private readonly slackService = new SlackService();
  private readonly changelogService = new ChangelogService();
  private readonly aiService = new AiService();
  private readonly githubService = new GitHubService();
  /**
   * Signs a state payload for GitHub App install redirects.
   * Called when generating the install URL to embed a verifiable signature.
   */
  public static signState(payload: Record<string, unknown>): string {
    const data = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', WEBHOOK_STATE_SECRET).update(data).digest('hex');
    return Buffer.from(JSON.stringify({ d: data, s: hmac })).toString('base64url');
  }

  public async githubAppCallback(req: Request, res: Response): Promise<void> {
    const installationId = req.query['installation_id'] as string | undefined;
    const state = req.query['state'] as string | undefined;

    let productId = '';
    if (state) {
      try {
        const outer = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8')) as { d?: string; s?: string; productId?: string };

        // Support signed state (new format: { d, s }) and legacy unsigned format
        if (outer.d && outer.s) {
          const expectedHmac = crypto.createHmac('sha256', WEBHOOK_STATE_SECRET).update(outer.d).digest('hex');
          if (!crypto.timingSafeEqual(Buffer.from(outer.s, 'hex'), Buffer.from(expectedHmac, 'hex'))) {
            serverLogger.warn('GitHub callback state signature mismatch — possible CSRF');
            res.redirect('/admin/products');
            return;
          }
          const parsed = JSON.parse(outer.d) as { productId?: string };
          productId = parsed.productId || '';
        } else if (outer.productId) {
          // Legacy unsigned format — log a warning but still allow
          serverLogger.warn('GitHub callback received unsigned state — migrate to signed state');
          productId = outer.productId;
        }
      } catch {
        serverLogger.warn({ state }, 'Failed to parse GitHub callback state');
      }
    }

    if (!productId) {
      res.redirect('/admin/products');
      return;
    }

    const params = new URLSearchParams({ tab: 'repositories' });
    if (installationId) {
      params.set('installation_id', installationId);
    }

    res.redirect(`/admin/products/${encodeURIComponent(productId)}?${params.toString()}`);
  }

  /**
   * Handles incoming GitHub webhook events.
   * Accepts release, push, and pull_request events.
   * Signature verification is handled by the verifyGitHubWebhook middleware.
   */
  public async githubWebhook(req: Request, res: Response): Promise<void> {
    const event = req.headers['x-github-event'] as string;

    if (!this.isRelevantEvent(event, req.body as Record<string, unknown>)) {
      res.status(200).json({ ok: true, ignored: true });
      return;
    }

    const body = req.body as {
      action: string;
      release?: Record<string, unknown>;
      repository: { full_name: string; default_branch?: string };
      ref?: string;
      pull_request?: { merged?: boolean };
    };
    const repoFullName = body.repository?.full_name;
    if (!repoFullName) {
      res.status(400).json({ error: 'Missing repository full_name' });
      return;
    }

    const prisma = getPrismaClient();
    const productRepos = await prisma.productRepository.findMany({
      where: { fullName: repoFullName },
    });

    if (productRepos.length === 0) {
      serverLogger.info({ repoFullName, event }, 'GitHub webhook event for untracked repository — ignoring');
      res.status(200).json({ ok: true, ignored: true });
      return;
    }

    serverLogger.info({ event, action: body.action, repoFullName, productCount: productRepos.length }, 'Processing GitHub webhook event');

    // Handle release upsert/delete synchronously (fast, idempotent)
    if (event === 'release' && body.release) {
      const releasePayload = body.release as GitHubWebhookReleasePayload;
      for (const productRepo of productRepos) {
        if (body.action === 'deleted') {
          await prisma.gitHubRelease.deleteMany({
            where: { repositoryId: productRepo.id, githubId: releasePayload.id },
          });
          serverLogger.info({ repoFullName, tag: releasePayload.tag_name, productId: productRepo.productId }, 'Deleted release via webhook');
        } else {
          await this.releaseService.upsertFromWebhook(productRepo.id, releasePayload);
          serverLogger.info(
            { repoFullName, tag: releasePayload.tag_name, action: body.action, productId: productRepo.productId },
            'Upserted release via webhook'
          );
        }

        await prisma.productRepository.update({
          where: { id: productRepo.id },
          data: { lastSyncedAt: new Date() },
        });
      }
    }

    // Respond 200 immediately — AI generation runs async in the background
    res.status(200).json({ ok: true });

    // Deduplicate product IDs and fire async auto-changelog generation
    const productIds = [...new Set(productRepos.map((r) => r.productId))];
    for (const productId of productIds) {
      serverLogger.info({ productId, event, action: body.action, repoFullName }, 'Triggering auto-changelog generation');
      this.generateAutoChangelog(productId).catch((err) =>
        serverLogger.error({ err, productId, event, action: body.action, repoFullName }, 'Auto-changelog generation failed')
      );
    }
  }

  /**
   * GET /webhooks/slack-callback — Slack OAuth callback (unauthenticated).
   */
  public async slackOAuthCallback(req: Request, res: Response): Promise<void> {
    const code = req.query['code'] as string | undefined;
    const state = req.query['state'] as string | undefined;
    const error = req.query['error'] as string | undefined;

    if (error) {
      res.redirect('/admin/settings?slack_error=access_denied');
      return;
    }

    if (!code || !state) {
      res.redirect('/admin/settings?slack_error=missing_params');
      return;
    }

    try {
      await this.slackService.handleOAuthCallback(code, state);
      res.redirect('/admin/settings?slack_connected=true');
    } catch (err) {
      serverLogger.error({ err }, 'Slack OAuth callback failed');
      const errorCode = this.classifyOAuthError(err);
      res.redirect(`/admin/settings?slack_error=${errorCode}`);
    }
  }

  /**
   * Checks whether this webhook event type + action is relevant for processing.
   */
  private isRelevantEvent(event: string, body: Record<string, unknown>): boolean {
    const action = body['action'] as string | undefined;

    if (event === 'release') {
      return ['published', 'created', 'edited', 'deleted'].includes(action || '');
    }

    if (event === 'push') {
      const ref = body['ref'] as string | undefined;
      const repo = body['repository'] as { default_branch?: string } | undefined;
      const defaultBranch = repo?.default_branch || 'main';
      return ref === `refs/heads/${defaultBranch}`;
    }

    if (event === 'pull_request') {
      const pr = body['pull_request'] as { merged?: boolean } | undefined;
      return action === 'closed' && pr?.merged === true;
    }

    return false;
  }

  /**
   * Generates or updates an automated draft changelog for a product.
   * Uses a DB-based lock (auto_changelog_locks table) for distributed concurrency
   * control across multiple replicas. Lock acquisition is atomic via raw SQL
   * INSERT ... ON CONFLICT to avoid TOCTOU races between replicas.
   * Stale locks (> STALE_LOCK_MS) are reclaimed automatically.
   */
  private async generateAutoChangelog(productId: string): Promise<void> {
    const prisma = getPrismaClient();
    const now = new Date();
    const staleThreshold = new Date(now.getTime() - STALE_LOCK_MS);

    // Atomic lock acquisition: insert if absent, or reclaim if stale.
    // If the lock exists and is not stale, mark it as pending_rerun instead.
    // Returns the rows affected — 1 means we acquired the lock, 0 means it was held by another replica.
    const acquired = await prisma.$executeRaw`
      INSERT INTO "auto_changelog_locks" ("product_id", "status", "locked_at", "updated_at")
      VALUES (${productId}, 'in_progress', ${now}, ${now})
      ON CONFLICT ("product_id") DO UPDATE
        SET "status" = 'in_progress', "locked_at" = ${now}, "updated_at" = ${now}
        WHERE "auto_changelog_locks"."locked_at" < ${staleThreshold}
    `;

    if (acquired === 0) {
      // Lock is held by another replica — mark pending rerun
      await prisma.autoChangelogLock.update({
        where: { productId },
        data: { status: 'pending_rerun' },
      });
      serverLogger.info({ productId }, 'Auto-changelog generation already in progress — marking pending rerun');
      return;
    }

    serverLogger.info({ productId }, 'Acquired auto-changelog lock — starting generation');

    // Run generation with lock held
    try {
      await this.doGenerateAutoChangelog(productId);
    } finally {
      // Release lock — check if a rerun was requested
      const lock = await prisma.autoChangelogLock.findUnique({ where: { productId } });
      if (lock?.status === 'pending_rerun') {
        // Reset to in_progress and rerun once.
        // NOTE: Webhooks arriving during this rerun are NOT re-queued — they will be
        // picked up by the next webhook event. This is intentional to prevent infinite loops.
        await prisma.autoChangelogLock.update({
          where: { productId },
          data: { status: 'in_progress', lockedAt: new Date() },
        });
        serverLogger.info({ productId }, 'Pending rerun detected — running one more generation');
        try {
          await this.doGenerateAutoChangelog(productId);
        } finally {
          await prisma.autoChangelogLock
            .delete({ where: { productId } })
            .catch((err) => serverLogger.warn({ err, productId }, 'Failed to delete auto-changelog lock after rerun'));
        }
      } else {
        await prisma.autoChangelogLock
          .delete({ where: { productId } })
          .catch((err) => serverLogger.warn({ err, productId }, 'Failed to delete auto-changelog lock'));
      }
    }
  }

  private async doGenerateAutoChangelog(productId: string): Promise<void> {
    const prisma = getPrismaClient();

    // 1. Ensure bot user exists
    const botUser = await prisma.user.upsert({
      where: { email: BOT_EMAIL },
      update: {},
      create: { email: BOT_EMAIL, name: BOT_NAME, auth0Id: null, avatarUrl: null },
      select: { id: true },
    });

    // 2. Determine "since" date — last published changelog or 30 days ago
    const lastPublished = await prisma.changelogEntry.findFirst({
      where: { productId, status: 'published' },
      orderBy: { publishedAt: 'desc' },
      select: { publishedAt: true, createdAt: true },
    });
    let sinceDate: string;
    if (lastPublished) {
      sinceDate = (lastPublished.publishedAt || lastPublished.createdAt).toISOString();
    } else {
      const fallback = new Date();
      fallback.setDate(fallback.getDate() - DEFAULT_LOOKBACK_DAYS);
      sinceDate = fallback.toISOString();
    }

    serverLogger.info({ productId, sinceDate }, 'Fetching GitHub activity for auto-changelog');

    // 3. Fetch all repos linked to this product
    const repos = await prisma.productRepository.findMany({ where: { productId } });
    if (repos.length === 0) {
      serverLogger.info({ productId }, 'No repositories linked to product — skipping auto-generation');
      return;
    }

    // 4. Gather GitHub activity across all repos
    const allCommits: GitHubCommit[] = [];
    const allMergedPRs: GitHubPullRequest[] = [];

    for (const repo of repos) {
      try {
        const [commits, prs] = await Promise.all([
          this.githubService.getCommitsSince(repo.githubInstallationId, repo.owner, repo.name, sinceDate, repo.fullName),
          this.githubService.getMergedPullRequestsSince(repo.githubInstallationId, repo.owner, repo.name, sinceDate, repo.fullName),
        ]);
        allCommits.push(...commits);
        allMergedPRs.push(...prs);
      } catch (err) {
        serverLogger.warn({ err, repo: repo.fullName }, 'Failed to fetch GitHub activity for repo — continuing with others');
      }
    }

    // 5. Fetch stored releases since date
    const storedReleases = await prisma.gitHubRelease.findMany({
      where: { repository: { productId }, publishedAt: { gte: new Date(sinceDate) } },
      include: { repository: true },
      orderBy: { publishedAt: 'desc' },
    });

    serverLogger.info(
      { productId, commits: allCommits.length, mergedPRs: allMergedPRs.length, releases: storedReleases.length, repoCount: repos.length },
      'Gathered GitHub activity for auto-changelog'
    );

    if (allCommits.length === 0 && allMergedPRs.length === 0 && storedReleases.length === 0) {
      serverLogger.info({ productId, sinceDate }, 'No new activity since last changelog — skipping auto-generation');
      return;
    }

    // 6. Build context string for AI
    const releaseContext = this.buildActivityContext(allCommits, allMergedPRs, storedReleases);

    // 7. Generate title + version and description in parallel
    const [metadata, description] = await Promise.all([
      this.aiService.generateChangelogMetadata(releaseContext),
      this.aiService.generateChangelogDescription(releaseContext),
    ]);

    // 8. Find or create the automated draft via ChangelogService
    const existingDraft = await this.changelogService.findAutomatedDraft(productId);

    if (existingDraft) {
      await this.changelogService.update(existingDraft.id, {
        title: metadata.title,
        description,
        version: metadata.version,
      });
      serverLogger.info(
        { productId, entryId: existingDraft.id, title: metadata.title, version: metadata.version },
        'Updated existing automated draft changelog'
      );
    } else {
      const entry = await this.changelogService.create({
        productId,
        title: metadata.title,
        description,
        version: metadata.version,
        source: 'automated',
        createdBy: botUser.id,
      });
      serverLogger.info({ productId, entryId: entry.id, title: metadata.title, version: metadata.version }, 'Created new automated draft changelog');
    }
  }

  /**
   * Builds a context string for AI from commits, merged PRs, and stored releases.
   */
  private buildActivityContext(
    commits: GitHubCommit[],
    mergedPRs: GitHubPullRequest[],
    storedReleases: { tagName: string; name: string | null; body: string | null; repository: { fullName: string } }[]
  ): string {
    const sections: string[] = [];

    if (storedReleases.length > 0) {
      const releasesByRepo = new Map<string, typeof storedReleases>();
      for (const release of storedReleases) {
        const repoName = release.repository.fullName;
        const existing = releasesByRepo.get(repoName) || [];
        existing.push(release);
        releasesByRepo.set(repoName, existing);
      }
      for (const [repoName, repoReleases] of releasesByRepo) {
        const lines = repoReleases
          .map((r) => {
            const name = r.name || r.tagName;
            const body = r.body ? `\n${r.body.slice(0, 1000)}` : '';
            return `### ${name} (${r.tagName})${body}`;
          })
          .join('\n\n');
        sections.push(`## Releases: ${repoName}\n\n${lines}`);
      }
    }

    if (mergedPRs.length > 0) {
      const prsByRepo = new Map<string, GitHubPullRequest[]>();
      for (const pr of mergedPRs) {
        const existing = prsByRepo.get(pr.repoFullName) || [];
        existing.push(pr);
        prsByRepo.set(pr.repoFullName, existing);
      }
      for (const [repoName, repoPRs] of prsByRepo) {
        const lines = repoPRs
          .slice(0, 50)
          .map((pr) => `- #${pr.number}: ${pr.title} (by @${pr.user.login})`)
          .join('\n');
        sections.push(`## Merged Pull Requests: ${repoName}\n\n${lines}`);
      }
    }

    if (commits.length > 0) {
      const commitsByRepo = new Map<string, GitHubCommit[]>();
      for (const commit of commits) {
        const existing = commitsByRepo.get(commit.repoFullName) || [];
        existing.push(commit);
        commitsByRepo.set(commit.repoFullName, existing);
      }
      for (const [repoName, repoCommits] of commitsByRepo) {
        const lines = repoCommits
          .slice(0, 50)
          .map((c) => `- ${c.commit.message.split('\n')[0]}`)
          .join('\n');
        sections.push(`## Commits: ${repoName}\n\n${lines}`);
      }
    }

    return `# GitHub Activity Summary\n\n${sections.join('\n\n')}`;
  }

  private classifyOAuthError(err: unknown): string {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('expired')) return 'state_expired';
    if (msg.includes('Invalid')) return 'invalid_state';
    return 'oauth_failed';
  }
}
