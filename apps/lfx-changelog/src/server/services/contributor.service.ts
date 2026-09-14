// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { ContributorSlackLinkSource, DEFAULT_LOOKBACK_DAYS, MAX_PAGE_SIZE } from '@lfx-changelog/shared';
import { Prisma } from '@prisma/client';

import { ConflictError, NotFoundError } from '../errors';
import { serverLogger } from '../server-logger';
import { GitHubService } from './github.service';
import { getPrismaClient } from './prisma.service';
import { SlackService } from './slack.service';

import type { ContributorQueryParams, ContributorSyncResult, SlackWorkspaceUser } from '@lfx-changelog/shared';
import type { Contributor as PrismaContributor, ProductRepository as PrismaProductRepository } from '@prisma/client';

/** GitHub's privacy-preserving commit addresses can never match a real Slack account. */
const NOREPLY_EMAIL_SUFFIX = '@users.noreply.github.com';

const CONTRIBUTOR_REPOSITORY_INCLUDE = {
  repositories: {
    include: {
      repository: {
        include: { product: { select: { id: true, name: true, slug: true, faIcon: true } } },
      },
    },
  },
} as const;

type PaginatedResult<T> = { data: T[]; total: number; page: number; pageSize: number; totalPages: number };

export class ContributorService {
  private readonly githubService = new GitHubService();
  private readonly slackService = new SlackService();

  // ── Reads ───────────────────────────────────

  public async findAll(params: ContributorQueryParams): Promise<PaginatedResult<unknown>> {
    const prisma = getPrismaClient();
    const { page, limit, skip } = this.sanitizePagination(params);
    const where = this.buildWhere(params);

    const [rows, total] = await Promise.all([
      prisma.contributor.findMany({
        where,
        orderBy: [{ contributions: 'desc' }, { githubLogin: 'asc' }],
        skip,
        take: limit,
        include: CONTRIBUTOR_REPOSITORY_INCLUDE,
      }),
      prisma.contributor.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.mapContributor(row)),
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  public async findById(id: string): Promise<unknown> {
    const prisma = getPrismaClient();
    const contributor = await prisma.contributor.findUnique({ where: { id }, include: CONTRIBUTOR_REPOSITORY_INCLUDE });
    if (!contributor) {
      throw new NotFoundError(`Contributor not found: ${id}`, { operation: 'findById', service: 'contributor' });
    }
    return this.mapContributor(contributor);
  }

  // ── Slack linking ───────────────────────────

  public async linkSlack(id: string, slackUserId: string, linkedById: string): Promise<unknown> {
    const prisma = getPrismaClient();
    await this.requireContributor(id);

    const workspaceUsers = await this.slackService.listWorkspaceUsers();
    const slackUser = workspaceUsers.find((user) => user.id === slackUserId);
    if (!slackUser) {
      throw new NotFoundError(`Slack user not found in the connected workspace: ${slackUserId}`, {
        operation: 'linkSlack',
        service: 'contributor',
      });
    }

    const alreadyLinked = await prisma.contributor.findFirst({ where: { slackUserId, id: { not: id } } });
    if (alreadyLinked) {
      throw new ConflictError(`Slack user ${slackUserId} is already linked to contributor ${alreadyLinked.githubLogin}`, {
        operation: 'linkSlack',
        service: 'contributor',
      });
    }

    const updated = await prisma.contributor.update({
      where: { id },
      data: this.slackLinkData(slackUser, ContributorSlackLinkSource.MANUAL, linkedById),
      include: CONTRIBUTOR_REPOSITORY_INCLUDE,
    });

    serverLogger.info({ contributorId: id, slackUserId, linkedById }, 'Contributor linked to Slack user');
    return this.mapContributor(updated);
  }

  public async unlinkSlack(id: string): Promise<unknown> {
    const prisma = getPrismaClient();
    await this.requireContributor(id);

    const updated = await prisma.contributor.update({
      where: { id },
      data: {
        slackUserId: null,
        slackTeamId: null,
        slackDisplayName: null,
        slackRealName: null,
        slackAvatarUrl: null,
        slackLinkSource: null,
        slackLinkedAt: null,
        slackLinkedById: null,
      },
      include: CONTRIBUTOR_REPOSITORY_INCLUDE,
    });

    serverLogger.info({ contributorId: id }, 'Contributor unlinked from Slack user');
    return this.mapContributor(updated);
  }

  // ── Sync ────────────────────────────────────

  /**
   * Pulls contributors from every tracked repository (optionally narrowed to one product or
   * repository), enriches them with commit-author emails, and attempts an email-based Slack match.
   *
   * Each repository is isolated: a failure against one repo is recorded and the sync continues,
   * mirroring how release syncing behaves.
   */
  public async sync(options: { productId?: string; repositoryId?: string } = {}): Promise<ContributorSyncResult> {
    const prisma = getPrismaClient();
    const repositories = await prisma.productRepository.findMany({
      where: {
        ...(options.repositoryId ? { id: options.repositoryId } : {}),
        ...(options.productId ? { productId: options.productId } : {}),
      },
    });

    const result: ContributorSyncResult = {
      repositoriesScanned: 0,
      contributorsCreated: 0,
      contributorsUpdated: 0,
      slackAutoLinked: 0,
      errors: [],
    };

    if (repositories.length === 0) {
      serverLogger.warn({ ...options }, 'Contributor sync found no tracked repositories');
      return result;
    }

    const slackUsersByEmail = await this.loadSlackUsersByEmail(result);

    for (const repository of repositories) {
      try {
        const counts = await this.syncRepository(repository, slackUsersByEmail);
        result.repositoriesScanned++;
        result.contributorsCreated += counts.created;
        result.contributorsUpdated += counts.updated;
        result.slackAutoLinked += counts.slackLinked;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        serverLogger.error({ err: error, repo: repository.fullName }, 'Failed to sync contributors for repository');
        result.errors.push(`${repository.fullName}: ${message}`);
      }
    }

    serverLogger.info({ ...result }, 'Contributor sync complete');
    return result;
  }

  // ── Private helpers ─────────────────────────

  private async syncRepository(
    repository: PrismaProductRepository,
    slackUsersByEmail: Map<string, SlackWorkspaceUser>
  ): Promise<{ created: number; updated: number; slackLinked: number }> {
    const prisma = getPrismaClient();
    const contributors = await this.githubService.getRepositoryContributors(repository.githubInstallationId, repository.owner, repository.name);
    const emailsByLogin = await this.collectCommitEmails(repository);

    let created = 0;
    let updated = 0;
    let slackLinked = 0;

    for (const contributor of contributors) {
      const isBot = contributor.type === 'Bot' || contributor.login.endsWith('[bot]');
      const discoveredEmails = emailsByLogin.get(contributor.login.toLowerCase()) ?? new Set<string>();

      const existing = await prisma.contributor.findUnique({ where: { githubUserId: contributor.id } });
      const mergedEmails = Array.from(new Set([...(existing?.emails ?? []), ...discoveredEmails])).sort();
      const primaryEmail = mergedEmails.find((email) => !email.endsWith(NOREPLY_EMAIL_SUFFIX)) ?? existing?.primaryEmail ?? null;

      const slackMatch = this.matchSlackUser(mergedEmails, slackUsersByEmail);
      const shouldAutoLink = Boolean(slackMatch) && !existing?.slackUserId;
      const linkedUserId = primaryEmail ? await this.findUserIdByEmail(primaryEmail) : null;

      const record = await prisma.contributor.upsert({
        where: { githubUserId: contributor.id },
        create: {
          githubUserId: contributor.id,
          githubLogin: contributor.login,
          githubAvatarUrl: contributor.avatar_url,
          githubHtmlUrl: contributor.html_url,
          primaryEmail,
          emails: mergedEmails,
          isBot,
          contributions: contributor.contributions,
          lastSyncedAt: new Date(),
          ...(linkedUserId ? { userId: linkedUserId } : {}),
          ...(slackMatch ? this.slackLinkData(slackMatch, ContributorSlackLinkSource.AUTO_EMAIL, null) : {}),
        },
        update: {
          githubLogin: contributor.login,
          githubAvatarUrl: contributor.avatar_url,
          githubHtmlUrl: contributor.html_url,
          primaryEmail,
          emails: mergedEmails,
          isBot,
          lastSyncedAt: new Date(),
          ...(linkedUserId && !existing?.userId ? { userId: linkedUserId } : {}),
          ...(shouldAutoLink && slackMatch ? this.slackLinkData(slackMatch, ContributorSlackLinkSource.AUTO_EMAIL, null) : {}),
        },
      });

      if (existing) {
        updated++;
      } else {
        created++;
      }
      if (shouldAutoLink) slackLinked++;

      await prisma.contributorRepository.upsert({
        where: { contributorId_repositoryId: { contributorId: record.id, repositoryId: repository.id } },
        create: { contributorId: record.id, repositoryId: repository.id, contributions: contributor.contributions },
        update: { contributions: contributor.contributions },
      });
    }

    await this.refreshContributionTotals(contributors.map((c) => c.id));

    serverLogger.info({ repo: repository.fullName, created, updated, slackLinked }, 'Synced contributors for repository');
    return { created, updated, slackLinked };
  }

  /**
   * Harvests git author emails from recent commits, keyed by GitHub login.
   *
   * The contributors endpoint never returns an email, so commits are the only place the
   * GitHub App can see one — and an email is the only reliable join key to a Slack account.
   */
  private async collectCommitEmails(repository: PrismaProductRepository): Promise<Map<string, Set<string>>> {
    const emailsByLogin = new Map<string, Set<string>>();
    const since = new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

    try {
      const commits = await this.githubService.getCommitsSince(repository.githubInstallationId, repository.owner, repository.name, since, repository.fullName);

      for (const commit of commits) {
        const login = commit.author?.login?.toLowerCase();
        const email = commit.commit?.author?.email;
        if (!login || !email) continue;

        const existing = emailsByLogin.get(login) ?? new Set<string>();
        existing.add(email.toLowerCase());
        emailsByLogin.set(login, existing);
      }
    } catch (error) {
      // Email enrichment is best-effort — a contributor without an email is still worth recording.
      serverLogger.warn({ err: error, repo: repository.fullName }, 'Failed to harvest commit author emails');
    }

    return emailsByLogin;
  }

  private async loadSlackUsersByEmail(result: ContributorSyncResult): Promise<Map<string, SlackWorkspaceUser>> {
    const byEmail = new Map<string, SlackWorkspaceUser>();
    try {
      const users = await this.slackService.listWorkspaceUsers();
      for (const user of users) {
        if (user.email) byEmail.set(user.email.toLowerCase(), user);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      serverLogger.warn({ err: error }, 'Slack directory unavailable — contributors will sync without Slack matching');
      result.errors.push(`Slack directory unavailable: ${message}`);
    }
    return byEmail;
  }

  private matchSlackUser(emails: string[], slackUsersByEmail: Map<string, SlackWorkspaceUser>): SlackWorkspaceUser | null {
    for (const email of emails) {
      if (email.endsWith(NOREPLY_EMAIL_SUFFIX)) continue;
      const match = slackUsersByEmail.get(email.toLowerCase());
      if (match) return match;
    }
    return null;
  }

  private slackLinkData(slackUser: SlackWorkspaceUser, source: ContributorSlackLinkSource, linkedById: string | null) {
    return {
      slackUserId: slackUser.id,
      slackTeamId: slackUser.teamId,
      slackDisplayName: slackUser.displayName,
      slackRealName: slackUser.realName,
      slackAvatarUrl: slackUser.avatarUrl,
      slackLinkSource: source,
      slackLinkedAt: new Date(),
      slackLinkedById: linkedById,
    };
  }

  private async findUserIdByEmail(email: string): Promise<string | null> {
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) return null;

    // userId is unique on Contributor — skip the link if this user is already claimed.
    const claimed = await prisma.contributor.findUnique({ where: { userId: user.id }, select: { id: true } });
    return claimed ? null : user.id;
  }

  /** Rolls the per-repository contribution counts up onto the contributor row. */
  private async refreshContributionTotals(githubUserIds: number[]): Promise<void> {
    if (githubUserIds.length === 0) return;
    const prisma = getPrismaClient();

    const contributors = await prisma.contributor.findMany({
      where: { githubUserId: { in: githubUserIds } },
      select: { id: true, repositories: { select: { contributions: true } } },
    });

    await Promise.all(
      contributors.map((contributor) =>
        prisma.contributor.update({
          where: { id: contributor.id },
          data: { contributions: contributor.repositories.reduce((sum, link) => sum + link.contributions, 0) },
        })
      )
    );
  }

  private async requireContributor(id: string): Promise<PrismaContributor> {
    const prisma = getPrismaClient();
    const contributor = await prisma.contributor.findUnique({ where: { id } });
    if (!contributor) {
      throw new NotFoundError(`Contributor not found: ${id}`, { operation: 'requireContributor', service: 'contributor' });
    }
    return contributor;
  }

  private buildWhere(params: ContributorQueryParams): Prisma.ContributorWhereInput {
    const where: Prisma.ContributorWhereInput = {};

    if (!params.includeBots) where.isBot = false;
    if (params.slackLink === 'linked') where.slackUserId = { not: null };
    if (params.slackLink === 'unlinked') where.slackUserId = null;

    if (params.repositoryId) {
      where.repositories = { some: { repositoryId: params.repositoryId } };
    } else if (params.productId) {
      where.repositories = { some: { repository: { productId: params.productId } } };
    }

    if (params.query) {
      where.OR = [
        { githubLogin: { contains: params.query, mode: 'insensitive' } },
        { name: { contains: params.query, mode: 'insensitive' } },
        { primaryEmail: { contains: params.query, mode: 'insensitive' } },
        { slackRealName: { contains: params.query, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private sanitizePagination(params: ContributorQueryParams): { page: number; limit: number; skip: number } {
    const page = Math.max(1, Math.floor(params.page || 1));
    const limit = Math.max(1, Math.min(Math.floor(params.limit || 20), MAX_PAGE_SIZE));
    return { page, limit, skip: (page - 1) * limit };
  }

  private mapContributor(row: PrismaContributor & { repositories?: ContributorRepositoryRow[] }) {
    const { repositories, ...rest } = row;
    return {
      ...rest,
      firstSeenAt: rest.firstSeenAt.toISOString(),
      lastActiveAt: rest.lastActiveAt?.toISOString() ?? null,
      lastSyncedAt: rest.lastSyncedAt?.toISOString() ?? null,
      slackLinkedAt: rest.slackLinkedAt?.toISOString() ?? null,
      createdAt: rest.createdAt.toISOString(),
      updatedAt: rest.updatedAt.toISOString(),
      repositories: (repositories ?? []).map((link) => ({
        id: link.id,
        repositoryId: link.repositoryId,
        contributions: link.contributions,
        lastActiveAt: link.lastActiveAt?.toISOString() ?? null,
        repositoryFullName: link.repository.fullName,
        repositoryHtmlUrl: link.repository.htmlUrl,
        productId: link.repository.product.id,
        productName: link.repository.product.name,
        productSlug: link.repository.product.slug,
        productFaIcon: link.repository.product.faIcon,
      })),
    };
  }
}

interface ContributorRepositoryRow {
  id: string;
  repositoryId: string;
  contributions: number;
  lastActiveAt: Date | null;
  repository: {
    fullName: string;
    htmlUrl: string;
    product: { id: string; name: string; slug: string; faIcon: string | null };
  };
}
