// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { createSdkMcpServer, query, tool } from '@anthropic-ai/claude-agent-sdk';
import { BOT_EMAIL, BOT_NAME, bumpPatchVersion, DEFAULT_LOOKBACK_DAYS, slugify, STALE_LOCK_MS } from '@lfx-changelog/shared';
import { z } from 'zod';

import {
  AGENT_CONFIG,
  AGENT_CRITIC_PROMPT,
  AGENT_SYSTEM_PROMPT,
  ALLOWED_ATLASSIAN_TOOLS,
  ALLOWED_CHANGELOG_TOOLS,
  DISALLOWED_ATLASSIAN_TOOLS,
} from '../constants/agent.constants';
import { AgentServiceError } from '../errors';
import { buildActivityContext } from '../helpers/activity-context.helper';
import { extractAtlassianReferences, formatAtlassianHints } from '../helpers/atlassian-reference.helper';
import { serverLogger } from '../server-logger';
import { agentJobEmitter } from './agent-job-emitter.service';
import { AgentMemoryService } from './agent-memory.service';
import { ChangelogService } from './changelog.service';
import { GitHubService } from './github.service';
import { getPrismaClient } from './prisma.service';
import { SlackService } from './slack.service';

import type { AgentJobTrigger, GitHubCommit, GitHubPullRequest, ProgressLogEntry } from '@lfx-changelog/shared';

export class ChangelogAgentService {
  private readonly changelogService = new ChangelogService();
  private readonly githubService = new GitHubService();
  private readonly agentMemoryService = new AgentMemoryService();
  private readonly slackService = new SlackService();
  private readonly activeControllers = new Map<string, AbortController>();

  /**
   * Runs the changelog agent for a product.
   * Creates an AgentJob record, pre-fetches GitHub data, then delegates to the agent.
   * Returns the job ID.
   */
  public async runAgentForProduct(productId: string, trigger: AgentJobTrigger, retryCount = 0): Promise<string> {
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
        // Stale lock with no active job — clean up and retry (once)
        if (retryCount > 0) {
          throw new AgentServiceError('Stale lock could not be cleared after retry', { operation: 'runAgentForProduct' });
        }
        serverLogger.warn({ productId, trigger }, 'Stale lock found with no active job — cleaning up and retrying');
        await prisma.autoChangelogLock.delete({ where: { productId } }).catch(() => undefined);
        return this.runAgentForProduct(productId, trigger, retryCount + 1);
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
   * Cancels a running/pending agent job.
   * Aborts the controller if active, updates DB status, clears lock, and emits SSE events.
   */
  public async cancelJob(jobId: string, productId: string): Promise<void> {
    const prisma = getPrismaClient();

    // Conditionally update only if still active — prevents overwriting a completed/failed job
    const updated = await prisma.agentJob.updateMany({
      where: { id: jobId, status: { in: ['pending', 'running'] } },
      data: { status: 'cancelled', completedAt: new Date() },
    });

    if (updated.count === 0) {
      serverLogger.warn({ jobId, productId }, 'Cancel requested but job is no longer active');
      return;
    }

    // Abort the controller if it exists (stops the agent query iterator).
    // The SDK may reject an internal write promise on abort — suppress it since this is expected.
    const controller = this.activeControllers.get(jobId);
    if (controller) {
      const suppressAbort = (err: unknown): void => {
        if (err instanceof Error && err.message === 'Operation aborted') return;
        throw err;
      };
      process.on('unhandledRejection', suppressAbort);
      controller.abort();
      // Remove after I/O phase — the SDK rejection fires within the current tick
      setImmediate(() => process.removeListener('unhandledRejection', suppressAbort));
    }

    // Emit SSE events so the frontend updates in real time
    agentJobEmitter.emit(jobId, { type: 'status', data: { status: 'cancelled' } });
    this.emitTerminalEvents(jobId, {
      durationMs: null,
      numTurns: null,
      promptTokens: null,
      outputTokens: null,
      changelogEntry: null,
      errorMessage: null,
    });

    serverLogger.info({ jobId, productId }, 'Agent job cancelled by user');
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
      // Check if the job was cancelled — if so, clean up the lock and skip rerun
      const currentJob = await prisma.agentJob.findUnique({ where: { id: jobId }, select: { status: true } });
      const wasCancelled = currentJob?.status === 'cancelled';

      if (wasCancelled) {
        await prisma.autoChangelogLock
          .delete({ where: { productId } })
          .catch((err) => serverLogger.warn({ err, productId }, 'Failed to delete auto-changelog lock after cancel'));
      } else {
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

      // 6b. Fetch agent memory
      const memoryData = await this.agentMemoryService.getMemoryForProduct(productId);
      const memoryContext = this.agentMemoryService.formatMemoryContext(memoryData);

      // 6c. Extract Atlassian references from activity data
      const atlassianRefs = extractAtlassianReferences(allCommits, allMergedPRs, storedReleases);
      const jiraRefs = atlassianRefs.filter((r) => r.type === 'jira-issue');
      const confluenceRefs = atlassianRefs.filter((r) => r.type === 'confluence-page');

      if (atlassianRefs.length > 0) {
        serverLogger.info(
          {
            jobId,
            productId,
            jiraIssues: jiraRefs.map((r) => r.key),
            confluencePages: confluenceRefs.map((r) => r.key),
            totalRefs: atlassianRefs.length,
          },
          'Extracted Atlassian references from activity data'
        );
      } else {
        serverLogger.debug({ jobId, productId }, 'No Atlassian references found in activity data');
      }

      const atlassianHints = formatAtlassianHints(atlassianRefs);

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
        memoryContext,
        atlassianHints,
      });

      // 8. Create MCP tools (pass jobId for precise linking)
      const mcpServer = this.createMcpTools(jobId, productId, botUser.id, product?.slug || 'unknown', activityContext);

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
      const abortController = new AbortController();
      this.activeControllers.set(jobId, abortController);
      const timeout = setTimeout(() => abortController.abort(), AGENT_CONFIG.TIMEOUT_MS);

      try {
        const mcpServers = this.buildMcpServers(mcpServer);

        const queryIterator = query({
          prompt: userPrompt,
          options: {
            systemPrompt: AGENT_SYSTEM_PROMPT,
            model: AGENT_CONFIG.MODEL,
            maxTurns: AGENT_CONFIG.MAX_TURNS,
            allowedTools: [...ALLOWED_CHANGELOG_TOOLS, ...ALLOWED_ATLASSIAN_TOOLS],
            disallowedTools: [...DISALLOWED_ATLASSIAN_TOOLS],
            permissionMode: 'bypassPermissions',
            allowDangerouslySkipPermissions: true,
            mcpServers,
            abortController,
            env: {
              PATH: process.env['PATH'] || '/usr/local/bin:/usr/bin:/bin',
              HOME: process.env['HOME'] || '/tmp',
              NODE_EXTRA_CA_CERTS: process.env['NODE_EXTRA_CA_CERTS'],
              ANTHROPIC_BASE_URL: baseUrl,
              ANTHROPIC_API_KEY: apiKey,
            },
          },
        });

        let numTurns = 0;
        let promptTokens = 0;
        let outputTokens = 0;

        for await (const message of queryIterator) {
          // Log progress entries
          if (message.type === 'assistant') {
            numTurns++;
            promptTokens += message.message.usage?.input_tokens ?? 0;
            outputTokens += message.message.usage?.output_tokens ?? 0;

            // Emit running stats so the UI updates incrementally
            agentJobEmitter.emit(jobId, {
              type: 'stats',
              data: { durationMs: Date.now() - startTime, numTurns, promptTokens, outputTokens },
            });

            for (const block of message.message.content) {
              if (block.type === 'tool_use') {
                const entry: ProgressLogEntry = {
                  timestamp: new Date().toISOString(),
                  type: 'tool_call',
                  tool: block.name,
                  summary: this.buildToolCallSummary(block.name, block.input as Record<string, unknown>),
                  args: block.input as ProgressLogEntry['args'],
                };
                progressLog.push(entry);
                agentJobEmitter.emit(jobId, { type: 'progress', data: entry });
              } else if (block.type === 'text' && block.text) {
                const entry: ProgressLogEntry = {
                  timestamp: new Date().toISOString(),
                  type: 'text',
                  summary: block.text.slice(0, 500),
                };
                progressLog.push(entry);
                agentJobEmitter.emit(jobId, { type: 'progress', data: entry });
              }
            }

            // Flush progress to DB so refreshing clients get catch-up data
            await prisma.agentJob.update({
              where: { id: jobId },
              data: { progressLog },
            });
          }

          // Log tool result errors (e.g. Atlassian MCP failures, tool timeouts)
          if (message.type === 'user' && Array.isArray((message.message as { content?: unknown }).content)) {
            for (const block of (message.message as { content: { type: string; is_error?: boolean; content?: unknown; tool_use_id?: string }[] }).content) {
              if (block.type === 'tool_result' && block.is_error) {
                const errorText = Array.isArray(block.content)
                  ? block.content.map((c: { text?: string }) => c.text || '').join(' ')
                  : String(block.content || 'Unknown error');
                serverLogger.warn({ jobId, productId, toolUseId: block.tool_use_id, error: errorText }, 'Agent tool call returned an error');
                const entry: ProgressLogEntry = {
                  timestamp: new Date().toISOString(),
                  type: 'error',
                  summary: `Tool error: ${errorText.slice(0, 500)}`,
                };
                progressLog.push(entry);
                agentJobEmitter.emit(jobId, { type: 'progress', data: entry });
              }
            }

            // Flush error entries to DB for catch-up on refresh
            await prisma.agentJob.update({
              where: { id: jobId },
              data: { progressLog },
            });
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
                include: { changelogEntry: { select: { id: true, title: true, slug: true, status: true } }, product: { select: { name: true } } },
              });
              serverLogger.info({ jobId, productId, durationMs, numTurns: message.num_turns }, 'Agent job completed successfully');
              agentJobEmitter.emit(jobId, { type: 'status', data: { status: 'completed' } });

              // Record quality scores from critic (fire-and-forget)
              this.recordScoresFromProgressLog(jobId, productId, progressLog).catch((err) =>
                serverLogger.warn({ err, jobId }, 'Failed to record quality scores')
              );

              // Notify configured users via Slack DM — release-triggered jobs only (fire-and-forget)
              if (updatedJob.trigger === 'webhook_release' && updatedJob.changelogEntry && updatedJob.product) {
                const entry = { id: updatedJob.changelogEntry.id, title: updatedJob.changelogEntry.title };
                this.slackService
                  .sendDraftReadyDms(productId, entry, updatedJob.product.name)
                  .then(async (notified) => {
                    if (notified.length === 0) return;
                    const dmEntry: ProgressLogEntry = {
                      timestamp: new Date().toISOString(),
                      type: 'text',
                      summary: `Slack DM sent to: ${notified.join(', ')}`,
                    };
                    await prisma.agentJob.update({
                      where: { id: jobId },
                      data: { progressLog: [...progressLog, dmEntry] },
                    });
                    agentJobEmitter.emit(jobId, { type: 'progress', data: dmEntry });
                  })
                  .catch((err) => serverLogger.warn({ err, jobId, productId }, 'Failed to send draft-ready DMs'));
              }

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
        this.activeControllers.delete(jobId);
      }
    } catch (err) {
      // If the job was already cancelled by the user, don't overwrite with 'failed'
      const existingJob = await prisma.agentJob.findUnique({ where: { id: jobId }, select: { status: true } });
      if (existingJob?.status === 'cancelled') {
        serverLogger.info({ jobId, productId }, 'Agent job was cancelled — skipping error handling');
        return;
      }

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

  private buildMcpServers(
    mcpServer: ReturnType<typeof createSdkMcpServer>
  ): Record<string, ReturnType<typeof createSdkMcpServer> | { type: 'http'; url: string; headers?: Record<string, string> }> {
    const servers: Record<string, ReturnType<typeof createSdkMcpServer> | { type: 'http'; url: string; headers?: Record<string, string> }> = {
      'changelog-tools': mcpServer,
    };

    const atlassianEmail = process.env['ATLASSIAN_EMAIL'];
    const atlassianToken = process.env['ATLASSIAN_API_KEY'];
    const atlassianUrl = process.env['ATLASSIAN_URL'] || 'https://mcp.atlassian.com/v1/mcp';

    if (atlassianEmail && atlassianToken) {
      servers['atlassian'] = {
        type: 'http',
        url: atlassianUrl,
        headers: {
          Authorization: `Basic ${Buffer.from(`${atlassianEmail}:${atlassianToken}`).toString('base64')}`,
        },
      };
      serverLogger.info({ url: atlassianUrl }, 'Atlassian MCP server configured for agent');
    } else {
      serverLogger.debug('Atlassian MCP not configured — ATLASSIAN_EMAIL or ATLASSIAN_API_KEY not set');
    }

    return servers;
  }

  private buildToolCallSummary(toolName: string, args: Record<string, unknown>): string {
    const shortName = toolName.replace(/^mcp__[^_]+__/, '');

    // Atlassian tools — surface the key identifier
    if (toolName.includes('__atlassian__')) {
      // Find a Jira issue key in any arg value (e.g. issueIdOrKey, issue_key, issueKey)
      const jiraKeyPattern = /^[A-Z][A-Z0-9]+-\d+$/;
      const jiraKey = Object.values(args).find((v) => typeof v === 'string' && jiraKeyPattern.test(v));
      if (jiraKey) return `Fetching Jira issue ${jiraKey}`;
      if (args['jql']) return `Searching Jira: ${String(args['jql']).slice(0, 100)}`;
      // Find a Confluence page/space identifier
      const pageId = args['page_id'] || args['pageId'] || args['pageID'];
      if (pageId) return `Fetching Confluence page ${pageId}`;
      const spaceKey = args['space_key'] || args['spaceKey'];
      if (spaceKey) return `Listing pages in Confluence space ${spaceKey}`;
      return `Called ${shortName}`;
    }

    // Changelog tools — surface relevant context
    if (toolName.includes('__changelog-tools__')) {
      if (shortName === 'search_past_changelogs') return `Searching past changelogs${args['limit'] ? ` (limit: ${args['limit']})` : ''}`;
      if (shortName === 'create_changelog_draft' && args['title']) return `Creating draft: "${args['title']}"`;
      if (shortName === 'update_changelog_draft') return `Updating draft${args['title'] ? `: "${args['title']}"` : ''}`;
      if (shortName === 'validate_changelog_draft') return 'Running critic validation';
      if (shortName === 'get_latest_version') return 'Getting latest version';
      return `Called ${shortName}`;
    }

    return `Called ${shortName}`;
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
    memoryContext: string;
    atlassianHints: string;
  }): string {
    const lines = [
      `Product: ${context.productName} (${context.productSlug})`,
      context.productDescription ? `Product description: ${context.productDescription}` : '',
      `Since: ${context.sinceDate}`,
      context.existingDraftId ? `Existing draft ID: ${context.existingDraftId} (use update_changelog_draft)` : 'No existing draft (use create_changelog_draft)',
      context.latestVersion ? `Latest version: ${context.latestVersion}` : 'No previous version — use 1.0.0 as the starting version',
      context.totalActivities < 3 ? 'Note: Trivial activity — skip the critic validation step.' : '',
      '',
      context.memoryContext,
      '',
      context.atlassianHints,
      '',
      context.activityContext,
    ];
    return lines.filter(Boolean).join('\n');
  }

  private createMcpTools(jobId: string, productId: string, botUserId: string, productSlug: string, activityContext: string) {
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
          description: e.description?.slice(0, 500),
        }));
        return { content: [{ type: 'text' as const, text: JSON.stringify(entries, null, 2) }] };
      }
    );

    const createChangelogDraft = tool(
      'create_changelog_draft',
      'Create a new automated draft changelog entry. Always creates as draft status.',
      {
        title: z.string().max(60),
        version: z.string(),
        description: z.string(),
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
      },
      async (args) => {
        const updateData: Record<string, string> = {};
        if (args.title) updateData['title'] = args.title;
        if (args.version) updateData['version'] = args.version;
        if (args.description) updateData['description'] = args.description;

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
          select: { title: true, description: true, version: true },
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
          `Description:\n${draft.description}`,
          '',
          `Original activity data:\n${activityContext}`,
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

  /**
   * Walks the progress log to find critic scores from validate_changelog_draft.
   * Looks for a text entry after the tool call that contains valid JSON scores.
   */
  private async recordScoresFromProgressLog(jobId: string, productId: string, progressLog: ProgressLogEntry[]): Promise<void> {
    const CriticResponseSchema = z.object({
      scores: z.object({
        accuracy: z.number().min(1).max(5),
        clarity: z.number().min(1).max(5),
        tone: z.number().min(1).max(5),
        completeness: z.number().min(1).max(5),
      }),
      overall: z.number().min(1).max(5),
    });

    for (let i = 0; i < progressLog.length; i++) {
      const entry = progressLog[i];
      if (entry.type !== 'tool_call' || entry.tool !== 'validate_changelog_draft') continue;

      // The critic response appears as a subsequent text entry
      for (let j = i + 1; j < progressLog.length; j++) {
        const nextEntry = progressLog[j];
        if (nextEntry.type === 'text' && nextEntry.summary) {
          try {
            const raw = JSON.parse(nextEntry.summary);
            const parseResult = CriticResponseSchema.safeParse(raw);
            if (parseResult.success) {
              const { scores, overall } = parseResult.data;
              await this.agentMemoryService.recordQualityScores(jobId, productId, { ...scores, overall });
              return;
            }
          } catch {
            // Not valid JSON — continue looking
          }
        }
        // Stop searching if we hit another tool call
        if (nextEntry.type === 'tool_call') break;
      }
    }
  }
}
