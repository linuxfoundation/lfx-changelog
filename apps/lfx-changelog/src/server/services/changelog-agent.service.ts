// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { createSdkMcpServer, query, tool } from '@anthropic-ai/claude-agent-sdk';
import { BOT_EMAIL, BOT_NAME, bumpPatchVersion, DEFAULT_LOOKBACK_DAYS, slugify } from '@lfx-changelog/shared';
import { z } from 'zod';

import { AGENT_CONFIG, AGENT_SYSTEM_PROMPT } from '../constants/agent.constants';
import { AgentServiceError } from '../errors';
import { buildActivityContext } from '../helpers/activity-context.helper';
import { serverLogger } from '../server-logger';
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

    // Guard: skip if there's already a pending or running job for this product
    const existingJob = await prisma.agentJob.findFirst({
      where: { productId, status: { in: ['pending', 'running'] } },
      select: { id: true, status: true },
    });

    if (existingJob) {
      serverLogger.info({ productId, trigger, existingJobId: existingJob.id, existingStatus: existingJob.status }, 'Skipping agent run — job already in progress');
      return existingJob.id;
    }

    // 1. Create job record
    const job = await prisma.agentJob.create({
      data: { productId, trigger, status: 'pending', progressLog: [] },
    });

    serverLogger.info({ jobId: job.id, productId, trigger }, 'Created agent job');

    // Run async — don't block the caller
    this.executeJob(job.id, productId).catch((err) => {
      serverLogger.error({ err, jobId: job.id, productId }, 'Agent job execution failed unexpectedly');
    });

    return job.id;
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
        await prisma.agentJob.update({
          where: { id: jobId },
          data: { status: 'completed', completedAt: new Date(), durationMs: Date.now() - startTime, progressLog },
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
        await prisma.agentJob.update({
          where: { id: jobId },
          data: { status: 'completed', completedAt: new Date(), durationMs: Date.now() - startTime, progressLog },
        });
        return;
      }

      // 6. Build context
      const activityContext = buildActivityContext(allCommits, allMergedPRs, storedReleases);
      const existingDraft = await this.changelogService.findAutomatedDraft(productId);
      const latestVersion = await this.changelogService.getLatestVersion(productId);
      const product = await prisma.product.findUnique({ where: { id: productId }, select: { name: true, slug: true } });

      // 7. Build user prompt
      const userPrompt = this.buildUserPrompt({
        productName: product?.name || 'Unknown Product',
        productSlug: product?.slug || 'unknown',
        sinceDate,
        existingDraftId: existingDraft?.id || null,
        latestVersion,
        activityContext,
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
              } else if (block.type === 'text' && block.text) {
                const entry: ProgressLogEntry = {
                  timestamp: new Date().toISOString(),
                  type: 'text',
                  summary: block.text.slice(0, 200),
                };
                progressLog.push(entry);
              }
            }
          }

          // Handle final result
          if ('subtype' in message && message.type === 'result') {
            const durationMs = Date.now() - startTime;

            if (message.subtype === 'success') {
              await prisma.agentJob.update({
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
              });
              serverLogger.info({ jobId, productId, durationMs, numTurns: message.num_turns }, 'Agent job completed successfully');
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
            }
          }
        }
      } finally {
        clearTimeout(timeout);
      }
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      progressLog.push({
        timestamp: new Date().toISOString(),
        type: 'error',
        summary: errorMessage.slice(0, 500),
      });

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
    }
  }

  private buildUserPrompt(context: {
    productName: string;
    productSlug: string;
    sinceDate: string;
    existingDraftId: string | null;
    latestVersion: string | null;
    activityContext: string;
  }): string {
    const lines = [
      `Product: ${context.productName}`,
      `Since: ${context.sinceDate}`,
      context.existingDraftId ? `Existing draft ID: ${context.existingDraftId} (use update_changelog_draft)` : 'No existing draft (use create_changelog_draft)',
      context.latestVersion ? `Latest version: ${context.latestVersion}` : 'No previous version — use 1.0.0 as the starting version',
      '',
      context.activityContext,
    ];
    return lines.join('\n');
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

    return createSdkMcpServer({
      name: 'changelog-tools',
      tools: [searchPastChangelogs, createChangelogDraft, updateChangelogDraft, getLatestVersion],
    });
  }
}
