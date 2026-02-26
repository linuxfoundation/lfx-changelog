// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { serverLogger } from '../server-logger';
import { AiService } from '../services/ai.service';
import { ChangelogService } from '../services/changelog.service';
import { GitHubService } from '../services/github.service';
import { ProductRepositoryService } from '../services/product-repository.service';

import type { ChangelogSSEEventType, GenerateChangelogRequest, GitHubCommit, GitHubRelease } from '@lfx-changelog/shared';
import type { NextFunction, Request, Response } from 'express';

export class AiController {
  private readonly aiService = new AiService();
  private readonly changelogService = new ChangelogService();
  private readonly githubService = new GitHubService();
  private readonly productRepositoryService = new ProductRepositoryService();

  public async summarizeChanges(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const result = await this.changelogService.findPublished({ limit: 100 });

      const currentMonthEntries = result.data.filter((entry) => {
        const publishedAt = entry.publishedAt ? new Date(entry.publishedAt) : null;
        return publishedAt && publishedAt >= startOfMonth;
      });

      const summary = await this.aiService.generateSummary(currentMonthEntries);
      res.json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  }

  public async generateChangelog(req: Request, res: Response): Promise<void> {
    const { productId, releaseCount, additionalContext } = req.body as GenerateChangelogRequest;

    if (!productId || !releaseCount || releaseCount < 1 || releaseCount > 50) {
      res.status(400).json({ success: false, error: 'productId and releaseCount (1-50) are required' });
      return;
    }

    // Set SSE headers — Content-Encoding: identity bypasses compression middleware
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Content-Encoding', 'identity');
    res.flushHeaders();

    // Abort controller for cascading cancellation
    const abortController = new AbortController();
    let clientDisconnected = false;

    req.on('close', () => {
      clientDisconnected = true;
      abortController.abort();
    });

    const sendEvent = (type: ChangelogSSEEventType, data: string): void => {
      if (clientDisconnected) return;
      res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      // 1. Fetch linked repositories
      sendEvent('status', 'Fetching linked repositories...');
      const repos = await this.productRepositoryService.findByProductId(productId);

      if (repos.length === 0) {
        sendEvent('error', 'No GitHub repositories linked to this product.');
        res.end();
        return;
      }

      // 2. Fetch releases from each repo
      sendEvent('status', `Fetching releases from ${repos.length} repositor${repos.length === 1 ? 'y' : 'ies'}...`);

      const allReleases: GitHubRelease[] = [];
      const allCommits: GitHubCommit[] = [];

      for (const repo of repos) {
        if (clientDisconnected) return;

        const releases = await this.githubService.getRepositoryReleases(repo.githubInstallationId, repo.owner, repo.name, repo.fullName, releaseCount);
        allReleases.push(...releases);

        // Fetch commits between consecutive release tags
        if (releases.length >= 2) {
          sendEvent('status', `Fetching commits for ${repo.fullName}...`);
          for (let i = 0; i < releases.length - 1; i++) {
            if (clientDisconnected) return;

            const commits = await this.githubService.getCompareCommits(
              repo.githubInstallationId,
              repo.owner,
              repo.name,
              releases[i + 1].tag_name,
              releases[i].tag_name,
              repo.fullName
            );
            allCommits.push(...commits);
          }
        }
      }

      if (allReleases.length === 0) {
        sendEvent('error', 'No releases found in the linked repositories.');
        res.end();
        return;
      }

      // 3. Build context string for AI
      sendEvent('status', 'Analyzing release data...');
      const releaseContext = this.buildReleaseContext(allReleases, allCommits);

      // 4. Call 1: Generate title + version (non-streaming)
      sendEvent('status', 'Generating title and version...');
      const metadata = await this.aiService.generateChangelogMetadata(releaseContext, additionalContext, abortController.signal);
      if (clientDisconnected) return;

      sendEvent('title', metadata.title);
      sendEvent('version', metadata.version);

      // 5. Call 2: Stream description
      sendEvent('status', 'Generating changelog description...');

      for await (const chunk of this.aiService.streamChangelogDescription(releaseContext, additionalContext, abortController.signal)) {
        if (clientDisconnected) return;
        sendEvent('content', chunk);
      }

      sendEvent('done', 'complete');
    } catch (error) {
      if (clientDisconnected) return;
      serverLogger.error({ err: error }, 'Changelog generation failed');
      sendEvent('error', this.toUserFriendlyError(error));
    } finally {
      if (!clientDisconnected) {
        res.end();
      }
    }
  }

  private buildReleaseContext(releases: GitHubRelease[], commits: GitHubCommit[]): string {
    const sections: string[] = [];

    // Group releases by repo
    const releasesByRepo = new Map<string, GitHubRelease[]>();
    for (const release of releases) {
      const existing = releasesByRepo.get(release.repoFullName) || [];
      existing.push(release);
      releasesByRepo.set(release.repoFullName, existing);
    }

    for (const [repoName, repoReleases] of releasesByRepo) {
      const releaseLines = repoReleases
        .map((r) => {
          const name = r.name || r.tag_name;
          const body = r.body ? `\n${r.body.slice(0, 1000)}` : '';
          return `### ${name} (${r.tag_name})${body}`;
        })
        .join('\n\n');

      sections.push(`## Repository: ${repoName}\n\n${releaseLines}`);
    }

    // Add commit summaries
    if (commits.length > 0) {
      const commitsByRepo = new Map<string, GitHubCommit[]>();
      for (const commit of commits) {
        const existing = commitsByRepo.get(commit.repoFullName) || [];
        existing.push(commit);
        commitsByRepo.set(commit.repoFullName, existing);
      }

      for (const [repoName, repoCommits] of commitsByRepo) {
        const commitLines = repoCommits
          .slice(0, 50) // Cap at 50 commits per repo to stay within context limits
          .map((c) => `- ${c.commit.message.split('\n')[0]}`)
          .join('\n');

        sections.push(`## Commits between releases: ${repoName}\n\n${commitLines}`);
      }
    }

    return `# GitHub Release Data\n\n${sections.join('\n\n')}`;
  }

  private toUserFriendlyError(error: unknown): string {
    const raw = error instanceof Error ? error.message : String(error);

    if (raw.includes('LITELLM_API_KEY is not configured')) {
      return 'AI service is not configured. Please contact an administrator.';
    }
    if (raw.includes('secretOrPrivateKey must have a value') || raw.includes('GITHUB_PRIVATE_KEY') || raw.includes('GITHUB_APP_ID')) {
      return 'GitHub integration is not configured. Please contact an administrator.';
    }
    if (raw.includes('timed out')) {
      return 'The AI service took too long to respond. Please try again.';
    }
    if (raw.includes('was cancelled') || raw.includes('AbortError')) {
      return 'Generation was cancelled.';
    }
    if (/LiteLLM returned [45]\d\d/.test(raw)) {
      return 'The AI service is temporarily unavailable. Please try again later.';
    }
    if (raw.includes('GitHub API error')) {
      return 'Failed to fetch data from GitHub. Please check repository access and try again.';
    }

    return 'Something went wrong while generating the changelog. Please try again.';
  }
}
