// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { createSdkMcpServer, query, tool } from '@anthropic-ai/claude-agent-sdk';
import { BOT_EMAIL, BOT_NAME } from '@lfx-changelog/shared';
import { z } from 'zod';

import { ALLOWED_BLOG_TOOLS, BLOG_AGENT_CONFIG, BLOG_AGENT_CRITIC_PROMPT, BLOG_AGENT_SYSTEM_PROMPT } from '../constants/blog-agent.constants';
import { AgentServiceError } from '../errors';
import { serverLogger } from '../server-logger';
import { agentJobEmitter } from './agent-job-emitter.service';
import { BlogService } from './blog.service';
import { getPrismaClient } from './prisma.service';

import type { ProgressLogEntry } from '@lfx-changelog/shared';

export class BlogAgentService {
  private readonly blogService = new BlogService();
  private readonly activeControllers = new Map<string, AbortController>();

  /**
   * Runs the blog agent to generate a monthly roundup for the given period.
   * Returns the job ID immediately; execution continues async.
   */
  public async runMonthlyRoundup(period: { start: Date; end: Date }): Promise<string> {
    const prisma = getPrismaClient();

    // Idempotency: check if a blog already exists for this period
    const existing = await prisma.blog.findFirst({
      where: { type: 'monthly_roundup', periodStart: period.start },
      select: { id: true, status: true },
    });

    if (existing?.status === 'published') {
      serverLogger.info({ periodStart: period.start }, 'Monthly roundup already published — skipping');
      throw new AgentServiceError('A published monthly roundup already exists for this period', {
        operation: 'runMonthlyRoundup',
      });
    }

    const existingDraftId = existing?.id || null;

    // Ensure bot user exists
    const botUser = await prisma.user.upsert({
      where: { email: BOT_EMAIL },
      update: {},
      create: { email: BOT_EMAIL, name: BOT_NAME, auth0Id: null, avatarUrl: null },
      select: { id: true },
    });

    // Use a serializable transaction to atomically check for active jobs and create a new one.
    // This prevents the TOCTOU race where two concurrent requests both pass the duplicate guard.
    let job: { id: string };
    try {
      job = await prisma.$transaction(
        async (tx) => {
          const activeJob = await tx.agentJob.findFirst({
            where: {
              trigger: 'newsletter_monthly',
              status: { in: ['pending', 'running'] },
            },
            select: { id: true },
          });

          if (activeJob) {
            serverLogger.info({ existingJobId: activeJob.id, periodStart: period.start }, 'Blog agent job already active — skipping');
            throw new AgentServiceError('A blog agent job is already running. Wait for it to complete or cancel it first.', {
              operation: 'runMonthlyRoundup',
            });
          }

          return tx.agentJob.create({
            data: { trigger: 'newsletter_monthly', status: 'pending', progressLog: [] },
          });
        },
        { isolationLevel: 'Serializable' }
      );
    } catch (err) {
      if (err instanceof AgentServiceError) throw err;
      // P2034: Prisma serialization failure (concurrent transaction conflict)
      if (err instanceof Error && 'code' in err && (err as any).code === 'P2034') {
        throw new AgentServiceError('A blog agent job is already running. Wait for it to complete or cancel it first.', {
          operation: 'runMonthlyRoundup',
        });
      }
      throw err;
    }

    serverLogger.info({ jobId: job.id, periodStart: period.start, periodEnd: period.end }, 'Created blog agent job');

    // Run async
    this.executeJob(job.id, period, botUser.id, existingDraftId).catch((err) => {
      serverLogger.error({ err, jobId: job.id }, 'Blog agent job execution failed unexpectedly');
    });

    return job.id;
  }

  /**
   * Cancels a running/pending blog agent job.
   */
  public async cancelJob(jobId: string): Promise<void> {
    const prisma = getPrismaClient();

    const updated = await prisma.agentJob.updateMany({
      where: { id: jobId, status: { in: ['pending', 'running'] } },
      data: { status: 'cancelled', completedAt: new Date() },
    });

    if (updated.count === 0) {
      serverLogger.warn({ jobId }, 'Cancel requested but blog agent job is no longer active');
      return;
    }

    const controller = this.activeControllers.get(jobId);
    if (controller) {
      controller.abort();
    }

    agentJobEmitter.emit(jobId, { type: 'status', data: { status: 'cancelled' } });
    this.emitTerminalEvents(jobId, {
      durationMs: null,
      numTurns: null,
      promptTokens: null,
      outputTokens: null,
      changelogEntry: null,
      errorMessage: null,
    });

    serverLogger.info({ jobId }, 'Blog agent job cancelled');
  }

  private async executeJob(jobId: string, period: { start: Date; end: Date }, botUserId: string, existingDraftId: string | null): Promise<void> {
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

      // 1. Fetch published changelogs in the period
      const changelogs = await prisma.changelogEntry.findMany({
        where: {
          status: 'published',
          publishedAt: { gte: period.start, lte: period.end },
        },
        include: {
          product: { select: { id: true, name: true, slug: true, description: true, faIcon: true } },
        },
        orderBy: { publishedAt: 'desc' },
      });

      if (changelogs.length === 0) {
        serverLogger.info({ jobId, periodStart: period.start }, 'No published changelogs in period — completing job');
        const durationMs = Date.now() - startTime;
        await prisma.agentJob.update({
          where: { id: jobId },
          data: { status: 'completed', completedAt: new Date(), durationMs, progressLog },
        });
        agentJobEmitter.emit(jobId, { type: 'status', data: { status: 'completed' } });
        this.emitTerminalEvents(jobId, { durationMs, numTurns: null, promptTokens: null, outputTokens: null, changelogEntry: null, errorMessage: null });
        return;
      }

      // 2. Group changelogs by product and build summaries
      const byProduct = new Map<string, { product: { id: string; name: string; slug: string; description: string | null }; entries: typeof changelogs }>();
      for (const entry of changelogs) {
        const key = entry.productId;
        if (!byProduct.has(key)) {
          byProduct.set(key, { product: entry.product, entries: [] });
        }
        byProduct.get(key)!.entries.push(entry);
      }

      const changelogSummary = this.buildChangelogSummary(byProduct);
      const productIds = [...byProduct.keys()];
      const changelogEntryIds = changelogs.map((c) => c.id);

      // 3. Build user prompt
      const monthName = period.start.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
      const userPrompt = this.buildUserPrompt({
        monthName,
        periodStart: period.start.toISOString(),
        periodEnd: period.end.toISOString(),
        productCount: byProduct.size,
        changelogCount: changelogs.length,
        existingDraftId,
        changelogSummary,
      });

      // 4. Create MCP tools
      const mcpServer = this.createMcpTools(jobId, botUserId, period, productIds, changelogEntryIds, changelogSummary);

      // 5. Derive Agent SDK env vars
      const aiApiUrl = process.env['AI_API_URL'] || '';
      const baseUrl = aiApiUrl.replace(/\/chat\/completions$/, '');
      const apiKey = process.env['LITELLM_API_KEY'] || '';

      if (!baseUrl || !apiKey) {
        throw new AgentServiceError('Missing AI_API_URL or LITELLM_API_KEY environment variables', {
          operation: 'executeJob',
        });
      }

      // 6. Run the agent
      const abortController = new AbortController();
      this.activeControllers.set(jobId, abortController);
      const timeout = setTimeout(() => abortController.abort(), BLOG_AGENT_CONFIG.TIMEOUT_MS);

      try {
        const queryIterator = query({
          prompt: userPrompt,
          options: {
            systemPrompt: BLOG_AGENT_SYSTEM_PROMPT,
            model: BLOG_AGENT_CONFIG.MODEL,
            maxTurns: BLOG_AGENT_CONFIG.MAX_TURNS,
            allowedTools: [...ALLOWED_BLOG_TOOLS],
            permissionMode: 'bypassPermissions',
            allowDangerouslySkipPermissions: true,
            mcpServers: { 'blog-tools': mcpServer },
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
          if (message.type === 'assistant') {
            numTurns++;
            promptTokens += message.message.usage?.input_tokens ?? 0;
            outputTokens += message.message.usage?.output_tokens ?? 0;

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

          // Log tool result errors (e.g. MCP failures, tool timeouts)
          if (message.type === 'user' && Array.isArray((message.message as { content?: unknown }).content)) {
            for (const block of (message.message as { content: { type: string; is_error?: boolean; content?: unknown; tool_use_id?: string }[] }).content) {
              if (block.type === 'tool_result' && block.is_error) {
                const errorText = Array.isArray(block.content)
                  ? block.content.map((c: { text?: string }) => c.text || '').join(' ')
                  : String(block.content || 'Unknown error');
                serverLogger.warn({ jobId, toolUseId: block.tool_use_id, error: errorText }, 'Blog agent tool call returned an error');
                const entry: ProgressLogEntry = {
                  timestamp: new Date().toISOString(),
                  type: 'error',
                  summary: `Tool error: ${errorText.slice(0, 500)}`,
                };
                progressLog.push(entry);
                agentJobEmitter.emit(jobId, { type: 'progress', data: entry });
              }
            }
          }

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
              serverLogger.info({ jobId, durationMs, numTurns: message.num_turns }, 'Blog agent job completed successfully');
              agentJobEmitter.emit(jobId, { type: 'status', data: { status: 'completed' } });
              this.emitTerminalEvents(jobId, {
                durationMs,
                numTurns: message.num_turns,
                promptTokens: message.usage['input_tokens'],
                outputTokens: message.usage['output_tokens'],
                changelogEntry: null,
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
              serverLogger.warn({ jobId, error: errorMsg }, 'Blog agent job completed with errors');
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
      const existingJob = await prisma.agentJob.findUnique({ where: { id: jobId }, select: { status: true } });
      if (existingJob?.status === 'cancelled') {
        serverLogger.info({ jobId }, 'Blog agent job was cancelled — skipping error handling');
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
        data: { status: 'failed', completedAt: new Date(), durationMs, errorMessage, progressLog },
      });

      serverLogger.error({ err, jobId, durationMs }, 'Blog agent job failed');
      agentJobEmitter.emit(jobId, { type: 'status', data: { status: 'failed' } });
      agentJobEmitter.emit(jobId, { type: 'error', data: errorMessage });
      this.emitTerminalEvents(jobId, { durationMs, numTurns: null, promptTokens: null, outputTokens: null, changelogEntry: null, errorMessage });
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

  private buildToolCallSummary(toolName: string, args: Record<string, unknown>): string {
    const shortName = toolName.replace(/^mcp__[^_]+__/, '');

    if (toolName.includes('__blog-tools__')) {
      if (shortName === 'get_changelogs_for_period') return `Fetching changelogs for ${args['month'] || 'period'}`;
      if (shortName === 'search_past_blogs' && args['query']) return `Searching past blogs: "${args['query']}"`;
      if (shortName === 'create_blog_draft' && args['title']) return `Creating draft: "${args['title']}"`;
      if (shortName === 'update_blog_draft') return `Updating draft${args['title'] ? `: "${args['title']}"` : ''}`;
      if (shortName === 'validate_blog_draft') return 'Running critic validation';
      return `Called ${shortName}`;
    }

    return `Called ${shortName}`;
  }

  private buildUserPrompt(context: {
    monthName: string;
    periodStart: string;
    periodEnd: string;
    productCount: number;
    changelogCount: number;
    existingDraftId: string | null;
    changelogSummary: string;
  }): string {
    const lines = [
      `Monthly roundup for: ${context.monthName}`,
      `Period: ${context.periodStart} to ${context.periodEnd}`,
      `Products with changes: ${context.productCount}`,
      `Total changelogs: ${context.changelogCount}`,
      '',
      context.existingDraftId ? `Existing draft ID: ${context.existingDraftId} (use update_blog_draft)` : 'No existing draft (use create_blog_draft)',
      context.changelogCount < 3 ? 'Note: Few changelogs — skip the critic validation step.' : '',
      '',
      context.changelogSummary,
    ];
    return lines.filter(Boolean).join('\n');
  }

  private buildChangelogSummary(
    byProduct: Map<
      string,
      {
        product: { id: string; name: string; slug: string; description: string | null };
        entries: { title: string; slug: string | null; description: string; version: string | null; publishedAt: Date | null }[];
      }
    >
  ): string {
    const sections: string[] = ['## Changelogs by Product\n'];

    for (const [, { product, entries }] of byProduct) {
      sections.push(`### ${product.name}`);
      if (product.description) {
        sections.push(`> ${product.description}`);
      }
      sections.push('');

      for (const entry of entries) {
        const version = entry.version ? ` (${entry.version})` : '';
        const slug = entry.slug ? ` | slug: ${entry.slug}` : '';
        sections.push(`- **${entry.title}**${version}${slug}`);
        // Cap description to prevent context overflow
        const desc = entry.description.slice(0, 200);
        sections.push(`  ${desc}${entry.description.length > 200 ? '...' : ''}`);
      }
      sections.push('');
    }

    return sections.join('\n');
  }

  private createMcpTools(
    jobId: string,
    botUserId: string,
    period: { start: Date; end: Date },
    productIds: string[],
    changelogEntryIds: string[],
    changelogSummary: string
  ) {
    const blogService = this.blogService;

    const getChangelogsForPeriod = tool(
      'get_changelogs_for_period',
      'Fetch published changelogs in the period, grouped by product with summaries. This is your primary data source.',
      {},
      async () => {
        return { content: [{ type: 'text' as const, text: changelogSummary }] };
      }
    );

    const searchPastBlogs = tool(
      'search_past_blogs',
      'Search past monthly roundup blogs for style and tone reference. Returns up to 3 recent published roundups.',
      { limit: z.number().int().min(1).max(5).optional() },
      async (args) => {
        const result = await blogService.findPublished({
          type: 'monthly_roundup',
          limit: args.limit || 3,
          page: 1,
        });
        const posts = result.data.map((b) => ({
          title: b.title,
          excerpt: b.excerpt,
          description: b.description?.slice(0, 800),
          periodStart: b.periodStart,
        }));
        return { content: [{ type: 'text' as const, text: JSON.stringify(posts, null, 2) }] };
      }
    );

    const createBlogDraft = tool(
      'create_blog_draft',
      'Create a new monthly roundup blog draft. Always creates as draft status.',
      {
        title: z.string().max(120),
        excerpt: z.string().max(300),
        description: z.string(),
      },
      async (args) => {
        const post = await blogService.create({
          title: args.title,
          excerpt: args.excerpt,
          description: args.description,
          type: 'monthly_roundup',
          periodStart: period.start.toISOString(),
          periodEnd: period.end.toISOString(),
          productIds,
          changelogEntryIds,
          createdBy: botUserId,
        });

        serverLogger.info({ blogId: post.id, title: args.title }, 'Blog agent created draft');

        // Link blog to agent job
        const prisma = getPrismaClient();
        await prisma.agentJob.update({
          where: { id: jobId },
          data: { blogId: post.id },
        });

        return { content: [{ type: 'text' as const, text: JSON.stringify({ id: post.id, slug: post.slug, status: 'draft' }) }] };
      }
    );

    const updateBlogDraft = tool(
      'update_blog_draft',
      'Update an existing blog draft.',
      {
        id: z.string().uuid(),
        title: z.string().max(120).optional(),
        excerpt: z.string().max(300).optional(),
        description: z.string().optional(),
      },
      async (args) => {
        const updateData: Record<string, string> = {};
        if (args.title) updateData['title'] = args.title;
        if (args.excerpt) updateData['excerpt'] = args.excerpt;
        if (args.description) updateData['description'] = args.description;

        const post = await blogService.update(args.id, updateData);

        // Re-link products and changelogs on update
        await blogService.linkProducts(args.id, productIds);
        await blogService.linkChangelogs(args.id, changelogEntryIds);

        serverLogger.info({ blogId: post.id, title: post.title }, 'Blog agent updated draft');

        // Link blog to agent job
        const prisma = getPrismaClient();
        await prisma.agentJob.update({
          where: { id: jobId },
          data: { blogId: post.id },
        });

        return { content: [{ type: 'text' as const, text: JSON.stringify({ id: post.id, slug: post.slug, status: 'draft' }) }] };
      }
    );

    const validateBlogDraft = tool(
      'validate_blog_draft',
      'Run a quality review on a saved blog draft. Returns scores and optional revision instructions. Skip if fewer than 3 changelogs.',
      { draftId: z.string().uuid() },
      async (args) => {
        const prisma = getPrismaClient();
        const draft = await prisma.blog.findUnique({
          where: { id: args.draftId },
          select: { title: true, excerpt: true, description: true },
        });
        if (!draft) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Draft not found' }) }] };
        }

        const aiApiUrl = process.env['AI_API_URL'] || '';
        const baseUrl = aiApiUrl.replace(/\/chat\/completions$/, '');
        const apiKey = process.env['LITELLM_API_KEY'] || '';

        if (!baseUrl || !apiKey) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Missing AI config for critic' }) }] };
        }

        const criticPrompt = [
          `Draft blog post:`,
          `Title: ${draft.title}`,
          `Excerpt: ${draft.excerpt}`,
          `Description:\n${draft.description}`,
          '',
          `Source changelogs:\n${changelogSummary}`,
        ].join('\n');

        try {
          let criticResponse = '';
          for await (const message of query({
            prompt: criticPrompt,
            options: {
              systemPrompt: BLOG_AGENT_CRITIC_PROMPT,
              model: BLOG_AGENT_CONFIG.MODEL,
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
          serverLogger.warn({ err, draftId: args.draftId }, 'Blog critic validation failed');
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: errorMsg }) }] };
        }
      }
    );

    return createSdkMcpServer({
      name: 'blog-tools',
      tools: [getChangelogsForPeriod, searchPastBlogs, createBlogDraft, updateBlogDraft, validateBlogDraft],
    });
  }
}
