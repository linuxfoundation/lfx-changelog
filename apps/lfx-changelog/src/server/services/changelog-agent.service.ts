// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { createSdkMcpServer, query, tool } from '@anthropic-ai/claude-agent-sdk';
import { BOT_EMAIL, BOT_NAME, bumpPatchVersion, ChangelogCategory, DEFAULT_LOOKBACK_DAYS, slugify, STALE_LOCK_MS } from '@lfx-changelog/shared';
import { z } from 'zod';

import { AGENT_CONFIG, AGENT_CRITIC_PROMPT, AGENT_SYSTEM_PROMPT } from '../constants/agent.constants';
import { AgentServiceError } from '../errors';
import { buildActivityContext } from '../helpers/activity-context.helper';
import { serverLogger } from '../server-logger';
import { agentJobEmitter } from './agent-job-emitter.service';
import { ChangelogService } from './changelog.service';
import { GitHubService } from './github.service';
import { getPrismaClient } from './prisma.service';

import type { AgentJobTrigger, GitHubCommit, GitHubPullRequest, ProgressLogEntry } from '@lfx-changelog/shared';

export class ChangelogAgentService {
  private readonly changelogService = new ChangelogService();
  private readonly githubService = new GitHubService();

  /**
   * Runs the changelog agent for a product.
   * Creates an AgentJob record, pre-fetches GitHub data, then delegates to the agent.
   * Returns the job ID.
   */
  public async runAgentForProduct(productId: string, trigger: AgentJobTrigger): Promise<string> {
    const prisma = getPrismaClient();
    const now = new Date();
    const staleThreshold = new Date(now.getTime() - STALE_LOCK_MS);

    // Atomic lock acquisition: insert if absent, or reclaim if stale.
    // If the lock exists and is not stale, mark it as pending_rerun instead.
    const acquired = await prisma.$executeRaw`
      INSERT INTO "auto_changelog_locks" ("product_id", "status", "locked_at", "updated_at")
      VALUES (${productId}, 'in_progress', ${now}, ${now})
      ON CONFLICT ("product_id") DO UPDATE
        SET "status" = 'in_progress', "locked_at" = ${now}, "updated_at" = ${now}
        WHERE "auto_changelog_locks"."locked_at" < ${staleThreshold}
    `;

    if (acquired === 0) {
      // Lock is held by another job — mark pending rerun so it re-runs after completion
      await prisma.autoChangelogLock.update({
        where: { productId },
        data: { status: 'pending_rerun' },
      });
      serverLogger.info({ productId, trigger }, 'Agent job already in progress — marking pending rerun');

      // Return the existing running job ID
      const existingJob = await prisma.agentJob.findFirst({
        where: { productId, status: { in: ['pending', 'running'] } },
        select: { id: true },
      });
      if (!existingJob) {
        throw new AgentServiceError('Agent job is already in progress but no active job record was found', {
          operation: 'runAgentForProduct',
        });
      }
      return existingJob.id;
    }

    serverLogger.info({ productId, trigger }, 'Acquired auto-changelog lock');

    // Create job record
    const job = await prisma.agentJob.create({
      data: { productId, trigger, status: 'pending', progressLog: [] },
    });

    serverLogger.info({ jobId: job.id, productId, trigger }, 'Created agent job');

    // Run async — don't block the caller
    this.runWithRerun(job.id, productId, trigger).catch((err) => {
      serverLogger.error({ err, jobId: job.id, productId }, 'Agent job execution failed unexpectedly');
    });

    return job.id;
  }

  /**
   * Executes the job, then checks if a rerun was requested (pending_rerun).
   * If so, runs once more with fresh data. Finally releases the lock.
   */
  private async runWithRerun(jobId: string, productId: string, trigger: AgentJobTrigger): Promise<void> {
    const prisma = getPrismaClient();

    try {
      await this.executeJob(jobId, productId);
    } finally {
      // Check if a rerun was requested while we were running
      const lock = await prisma.autoChangelogLock.findUnique({ where: { productId } });

      if (lock?.status === 'pending_rerun') {
        // Reset to in_progress and run once more with fresh data
        await prisma.autoChangelogLock.update({
          where: { productId },
          data: { status: 'in_progress', lockedAt: new Date() },
        });
        serverLogger.info({ productId }, 'Pending rerun detected — running one more agent job');

        const rerunJob = await prisma.agentJob.create({
          data: { productId, trigger, status: 'pending', progressLog: [] },
        });

        try {
          await this.executeJob(rerunJob.id, productId);
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

  private async executeJob(jobId: string, productId: string): Promise<void> {
    const prisma = getPrismaClient();
    const startTime = Date.now();
    const progressLog: ProgressLogEntry[] = [];

    try {
      // Mark as running
      await prisma.agentJob.update({
        where: { id: jobId },
        data: { status: 'running', startedAt: new Date() },
      });
      agentJobEmitter.emit(jobId, { type: 'status', data: { status: 'running' } });

      // 1. Ensure bot user exists
      const botUser = await prisma.user.upsert({
        where: { email: BOT_EMAIL },
        update: {},
        create: { email: BOT_EMAIL, name: BOT_NAME, auth0Id: null, avatarUrl: null },
        select: { id: true },
      });

      // 2. Determine "since" date
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

      // 3. Fetch repos
      const repos = await prisma.productRepository.findMany({ where: { productId } });
      if (repos.length === 0) {
        serverLogger.info({ jobId, productId }, 'No repositories linked — completing job with no output');
        const durationMs = Date.now() - startTime;
        await prisma.agentJob.update({
          where: { id: jobId },
          data: { status: 'completed', completedAt: new Date(), durationMs, progressLog },
        });
        agentJobEmitter.emit(jobId, { type: 'status', data: { status: 'completed' } });
        this.emitTerminalEvents(jobId, {
          durationMs,
          numTurns: null,
          promptTokens: null,
          outputTokens: null,
          changelogEntry: null,
          errorMessage: null,
        });
        return;
      }

      // 4. Gather GitHub activity
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
          serverLogger.warn({ err, repo: repo.fullName, jobId }, 'Failed to fetch GitHub activity — continuing');
        }
      }

      // 5. Fetch stored releases
      const storedReleases = await prisma.gitHubRelease.findMany({
        where: { repository: { productId }, publishedAt: { gte: new Date(sinceDate) } },
        include: { repository: true },
        orderBy: { publishedAt: 'desc' },
      });

      if (allCommits.length === 0 && allMergedPRs.length === 0 && storedReleases.length === 0) {
        serverLogger.info({ jobId, productId, sinceDate }, 'No new activity — completing job');
        const durationMs = Date.now() - startTime;
        await prisma.agentJob.update({
          where: { id: jobId },
          data: { status: 'completed', completedAt: new Date(), durationMs, progressLog },
        });
        agentJobEmitter.emit(jobId, { type: 'status', data: { status: 'completed' } });
        this.emitTerminalEvents(jobId, {
          durationMs,
          numTurns: null,
          promptTokens: null,
          outputTokens: null,
          changelogEntry: null,
          errorMessage: null,
        });
        return;
      }

      // 6. Build context
      const activityContext = buildActivityContext(allCommits, allMergedPRs, storedReleases);
      const existingDraft = await this.changelogService.findAutomatedDraft(productId);
      const latestVersion = await this.changelogService.getLatestVersion(productId);
      const product = await prisma.product.findUnique({ where: { id: productId }, select: { name: true, slug: true, description: true } });

      // 7. Build user prompt
      const totalActivities = allCommits.length + allMergedPRs.length;
      const userPrompt = this.buildUserPrompt({
        productName: product?.name || 'Unknown Product',
        productSlug: product?.slug || 'unknown',
        productDescription: product?.description || null,
        sinceDate,
        existingDraftId: existingDraft?.id || null,
        latestVersion,
        activityContext,
        totalActivities,
      });

      // 8. Create MCP tools (pass jobId for precise linking)
      const mcpServer = this.createMcpTools(jobId, productId, botUser.id, product?.slug || 'unknown');

      // 9. Derive Agent SDK env vars from existing LiteLLM config
      const aiApiUrl = process.env['AI_API_URL'] || '';
      const baseUrl = aiApiUrl.replace(/\/chat\/completions$/, '');
      const apiKey = process.env['LITELLM_API_KEY'] || '';

      if (!baseUrl || !apiKey) {
        throw new AgentServiceError('Missing AI_API_URL or LITELLM_API_KEY environment variables', {
          operation: 'executeJob',
        });
      }

      // 10. Run the agent
      serverLogger.info({ jobId, productId, model: AGENT_CONFIG.MODEL }, 'Starting agent query');

      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), AGENT_CONFIG.TIMEOUT_MS);

      try {
        for await (const message of query({
          prompt: userPrompt,
          options: {
            systemPrompt: AGENT_SYSTEM_PROMPT,
            model: AGENT_CONFIG.MODEL,
            maxTurns: AGENT_CONFIG.MAX_TURNS,
            allowedTools: [],
            permissionMode: 'bypassPermissions',
            allowDangerouslySkipPermissions: true,
            mcpServers: { 'changelog-tools': mcpServer },
            abortController,
            env: {
              PATH: process.env['PATH'] || '/usr/local/bin:/usr/bin:/bin',
              HOME: process.env['HOME'] || '/tmp',
              NODE_EXTRA_CA_CERTS: process.env['NODE_EXTRA_CA_CERTS'],
              ANTHROPIC_BASE_URL: baseUrl,
              ANTHROPIC_API_KEY: apiKey,
            },
          },
        })) {
          // Log progress entries
          if (message.type === 'assistant') {
            for (const block of message.message.content) {
              if (block.type === 'tool_use') {
                const entry: ProgressLogEntry = {
                  timestamp: new Date().toISOString(),
                  type: 'tool_call',
                  tool: block.name,
                  summary: `Called ${block.name}`,
                };
                progressLog.push(entry);
                agentJobEmitter.emit(jobId, { type: 'progress', data: entry });
              } else if (block.type === 'text' && block.text) {
                const entry: ProgressLogEntry = {
                  timestamp: new Date().toISOString(),
                  type: 'text',
                  summary: block.text.slice(0, 200),
                };
                progressLog.push(entry);
                agentJobEmitter.emit(jobId, { type: 'progress', data: entry });
              }
            }
          }

          // Handle final result
          if ('subtype' in message && message.type === 'result') {
            const durationMs = Date.now() - startTime;

            if (message.subtype === 'success') {
              const updatedJob = await prisma.agentJob.update({
                where: { id: jobId },
                data: {
                  status: 'completed',
                  completedAt: new Date(),
                  durationMs,
                  numTurns: message.num_turns,
                  promptTokens: message.usage['input_tokens'],
                  outputTokens: message.usage['output_tokens'],
                  progressLog,
                },
                include: { changelogEntry: { select: { id: true, title: true, status: true } } },
              });
              serverLogger.info({ jobId, productId, durationMs, numTurns: message.num_turns }, 'Agent job completed successfully');
              agentJobEmitter.emit(jobId, { type: 'status', data: { status: 'completed' } });
              this.emitTerminalEvents(jobId, {
                durationMs,
                numTurns: message.num_turns,
                promptTokens: message.usage['input_tokens'],
                outputTokens: message.usage['output_tokens'],
                changelogEntry: updatedJob.changelogEntry,
                errorMessage: null,
              });
            } else {
              const errorMsg = message.errors?.join('; ') || `Agent stopped: ${message.subtype}`;
              await prisma.agentJob.update({
                where: { id: jobId },
                data: {
                  status: 'failed',
                  completedAt: new Date(),
                  durationMs,
                  numTurns: message.num_turns,
                  promptTokens: message.usage['input_tokens'],
                  outputTokens: message.usage['output_tokens'],
                  errorMessage: errorMsg,
                  progressLog,
                },
              });
              serverLogger.warn({ jobId, productId, error: errorMsg }, 'Agent job completed with errors');
              agentJobEmitter.emit(jobId, { type: 'status', data: { status: 'failed' } });
              agentJobEmitter.emit(jobId, { type: 'error', data: errorMsg });
              this.emitTerminalEvents(jobId, {
                durationMs,
                numTurns: message.num_turns,
                promptTokens: message.usage['input_tokens'],
                outputTokens: message.usage['output_tokens'],
                changelogEntry: null,
                errorMessage: errorMsg,
              });
            }
          }
        }
      } finally {
        clearTimeout(timeout);
      }
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      const errorEntry: ProgressLogEntry = {
        timestamp: new Date().toISOString(),
        type: 'error',
        summary: errorMessage.slice(0, 500),
      };
      progressLog.push(errorEntry);
      agentJobEmitter.emit(jobId, { type: 'progress', data: errorEntry });

      await prisma.agentJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          durationMs,
          errorMessage,
          progressLog,
        },
      });

      serverLogger.error({ err, jobId, productId, durationMs }, 'Agent job failed');
      agentJobEmitter.emit(jobId, { type: 'status', data: { status: 'failed' } });
      agentJobEmitter.emit(jobId, { type: 'error', data: errorMessage });
      this.emitTerminalEvents(jobId, {
        durationMs,
        numTurns: null,
        promptTokens: null,
        outputTokens: null,
        changelogEntry: null,
        errorMessage,
      });
    }
  }

  private emitTerminalEvents(
    jobId: string,
    result: {
      durationMs: number | null;
      numTurns: number | null;
      promptTokens: number | null;
      outputTokens: number | null;
      changelogEntry: { id: string; title: string; status: string } | null;
      errorMessage: string | null;
    }
  ): void {
    agentJobEmitter.emit(jobId, { type: 'result', data: result });
    agentJobEmitter.emit(jobId, { type: 'done', data: '' });
    agentJobEmitter.removeAllForJob(jobId);
  }

  private buildUserPrompt(context: {
    productName: string;
    productSlug: string;
    productDescription: string | null;
    sinceDate: string;
    existingDraftId: string | null;
    latestVersion: string | null;
    activityContext: string;
    totalActivities: number;
  }): string {
    const lines = [
      `Product: ${context.productName} (${context.productSlug})`,
      context.productDescription ? `Product description: ${context.productDescription}` : '',
      `Since: ${context.sinceDate}`,
      context.existingDraftId ? `Existing draft ID: ${context.existingDraftId} (use update_changelog_draft)` : 'No existing draft (use create_changelog_draft)',
      context.latestVersion ? `Latest version: ${context.latestVersion}` : 'No previous version — use 1.0.0 as the starting version',
      context.totalActivities < 3 ? 'Note: Trivial activity — skip the critic validation step.' : '',
      '',
      context.activityContext,
    ];
    return lines.filter(Boolean).join('\n');
  }

  private createMcpTools(jobId: string, productId: string, botUserId: string, productSlug: string) {
    const changelogService = this.changelogService;

    const searchPastChangelogs = tool(
      'search_past_changelogs',
      'Search published changelogs for this product to match tone and style. Returns up to 5 recent entries.',
      { limit: z.number().int().min(1).max(10).optional() },
      async (args) => {
        const result = await changelogService.findPublished({
          productId,
          limit: args.limit || 5,
          page: 1,
        });
        const entries = result.data.map((e) => ({
          title: e.title,
          version: e.version,
          category: (e as { category?: string }).category ?? null,
          description: e.description?.slice(0, 500),
        }));
        return { content: [{ type: 'text' as const, text: JSON.stringify(entries, null, 2) }] };
      }
    );

    const categoryValues = Object.values(ChangelogCategory) as [string, ...string[]];

    const createChangelogDraft = tool(
      'create_changelog_draft',
      'Create a new automated draft changelog entry. Always creates as draft status.',
      {
        title: z.string().max(60),
        version: z.string(),
        description: z.string(),
        category: z.enum(categoryValues).optional(),
      },
      async (args) => {
        const titleSlug = slugify(args.title);
        const baseSlug = `${productSlug}-${titleSlug}`;
        const slug = await changelogService.ensureUniqueSlug(baseSlug);

        const entry = await changelogService.create({
          productId,
          slug,
          title: args.title,
          description: args.description,
          version: args.version,
          category: args.category,
          source: 'automated',
          createdBy: botUserId,
        });

        serverLogger.info({ entryId: entry.id, title: args.title, productId }, 'Agent created changelog draft');

        // Link the changelog to this specific agent job
        const prisma = getPrismaClient();
        await prisma.agentJob.update({
          where: { id: jobId },
          data: { changelogId: entry.id },
        });

        return { content: [{ type: 'text' as const, text: JSON.stringify({ id: entry.id, slug: entry.slug, status: 'draft' }) }] };
      }
    );

    const updateChangelogDraft = tool(
      'update_changelog_draft',
      'Update an existing automated draft changelog entry.',
      {
        id: z.string().uuid(),
        title: z.string().max(60).optional(),
        version: z.string().optional(),
        description: z.string().optional(),
        category: z.enum(categoryValues).optional(),
      },
      async (args) => {
        const updateData: Record<string, string> = {};
        if (args.title) updateData['title'] = args.title;
        if (args.version) updateData['version'] = args.version;
        if (args.description) updateData['description'] = args.description;
        if (args.category) updateData['category'] = args.category;

        if (args.title) {
          const titleSlug = slugify(args.title);
          const baseSlug = `${productSlug}-${titleSlug}`;
          updateData['slug'] = await changelogService.ensureUniqueSlug(baseSlug);
        }

        const entry = await changelogService.update(args.id, updateData);

        serverLogger.info({ entryId: entry.id, title: entry.title, productId }, 'Agent updated changelog draft');

        // Link the changelog to this specific agent job
        const prisma = getPrismaClient();
        await prisma.agentJob.update({
          where: { id: jobId },
          data: { changelogId: entry.id },
        });

        return { content: [{ type: 'text' as const, text: JSON.stringify({ id: entry.id, slug: entry.slug, status: 'draft' }) }] };
      }
    );

    const getLatestVersion = tool('get_latest_version', 'Get the latest version string for this product and compute the next patch version.', {}, async () => {
      const latest = await changelogService.getLatestVersion(productId);
      const next = bumpPatchVersion(latest);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ latestVersion: latest, suggestedNextVersion: next }) }] };
    });

    const validateChangelogDraft = tool(
      'validate_changelog_draft',
      'Run a quality review on a saved draft. Returns scores and optional revision instructions. Skip for trivial activity (<3 commits/PRs).',
      { draftId: z.string().uuid() },
      async (args) => {
        const prisma = getPrismaClient();
        const draft = await prisma.changelogEntry.findUnique({
          where: { id: args.draftId },
          select: { title: true, description: true, version: true, category: true },
        });
        if (!draft) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Draft not found' }) }] };
        }

        // Derive API config
        const aiApiUrl = process.env['AI_API_URL'] || '';
        const baseUrl = aiApiUrl.replace(/\/chat\/completions$/, '');
        const apiKey = process.env['LITELLM_API_KEY'] || '';

        if (!baseUrl || !apiKey) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Missing AI config for critic' }) }] };
        }

        const criticPrompt = [
          `Draft entry:`,
          `Title: ${draft.title}`,
          `Version: ${draft.version}`,
          `Category: ${draft.category ?? 'none'}`,
          `Description:\n${draft.description}`,
        ].join('\n');

        try {
          let criticResponse = '';
          for await (const message of query({
            prompt: criticPrompt,
            options: {
              systemPrompt: AGENT_CRITIC_PROMPT,
              model: AGENT_CONFIG.MODEL,
              maxTurns: 1,
              allowedTools: [],
              permissionMode: 'bypassPermissions',
              allowDangerouslySkipPermissions: true,
              env: {
                PATH: process.env['PATH'] || '/usr/local/bin:/usr/bin:/bin',
                HOME: process.env['HOME'] || '/tmp',
                NODE_EXTRA_CA_CERTS: process.env['NODE_EXTRA_CA_CERTS'],
                ANTHROPIC_BASE_URL: baseUrl,
                ANTHROPIC_API_KEY: apiKey,
              },
            },
          })) {
            if (message.type === 'assistant') {
              for (const block of message.message.content) {
                if (block.type === 'text') criticResponse += block.text;
              }
            }
          }

          return { content: [{ type: 'text' as const, text: criticResponse }] };
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Critic query failed';
          serverLogger.warn({ err, draftId: args.draftId }, 'Critic validation failed');
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: errorMsg }) }] };
        }
      }
    );

    return createSdkMcpServer({
      name: 'changelog-tools',
      tools: [searchPastChangelogs, createChangelogDraft, updateChangelogDraft, getLatestVersion, validateChangelogDraft],
    });
  }
}
