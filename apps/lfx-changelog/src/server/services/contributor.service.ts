// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { ContributorSlackLinkSource, DEFAULT_LOOKBACK_DAYS, MAX_PAGE_SIZE } from '@lfx-changelog/shared';
import { Prisma } from '@prisma/client';

import { ConflictError, NotFoundError } from '../errors';
import { serverLogger } from '../server-logger';
import { GitHubService } from './github.service';
import { getPrismaClient } from './prisma.service';
import { SlackService } from './slack.service';

import type { ContributorQueryParams, ContributorSyncResult, ContributorWithRelations, PaginatedResponse, SlackWorkspaceUser } from '@lfx-changelog/shared';
import type { Contributor as PrismaContributor, ProductRepository as PrismaProductRepository } from '@prisma/client';
import type { CommitProfile, ContributorRepositoryRow, RepositorySyncCounts } from '../interfaces/contributor.interface';

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

type PaginatedResult<T> = Omit<PaginatedResponse<T>, 'success'>;

export class ContributorService {
  private readonly githubService = new GitHubService();
  private readonly slackService = new SlackService();

  // ── Reads ───────────────────────────────────

  public async findAll(params: ContributorQueryParams): Promise<PaginatedResult<ContributorWithRelations>> {
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

  public async findById(id: string): Promise<ContributorWithRelations> {
    const prisma = getPrismaClient();
    const contributor = await prisma.contributor.findUnique({ where: { id }, include: CONTRIBUTOR_REPOSITORY_INCLUDE });
    if (!contributor) {
      throw new NotFoundError(`Contributor not found: ${id}`, { operation: 'findById', service: 'contributor' });
    }
    return this.mapContributor(contributor);
  }

  // ── Slack linking ───────────────────────────

  public async linkSlack(id: string, slackUserId: string, linkedById: string): Promise<ContributorWithRelations> {
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

  public async unlinkSlack(id: string): Promise<ContributorWithRelations> {
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
   * Pulls contributors from tracked repositories, enriches them from commit history, and
   * attempts an email-based Slack match. A failing repository is recorded, not fatal.
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

    // Keyed by GitHub user ID, not summed per repository — one person in five repos is one contributor.
    const createdIds = new Set<number>();
    const updatedIds = new Set<number>();

    for (const repository of repositories) {
      try {
        const counts = await this.syncRepository(repository, slackUsersByEmail);
        result.repositoriesScanned++;
        counts.created.forEach((id) => createdIds.add(id));
        counts.updated.forEach((id) => updatedIds.add(id));
        result.slackAutoLinked += counts.slackLinked;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        serverLogger.error({ err: error, repo: repository.fullName }, 'Failed to sync contributors for repository');
        result.errors.push(`${repository.fullName}: ${message}`);
      }
    }

    updatedIds.forEach((id) => {
      if (createdIds.has(id)) updatedIds.delete(id);
    });
    result.contributorsCreated = createdIds.size;
    result.contributorsUpdated = updatedIds.size;

    serverLogger.info({ ...result }, 'Contributor sync complete');
    return result;
  }

  // ── Private helpers ─────────────────────────

  private async syncRepository(repository: PrismaProductRepository, slackUsersByEmail: Map<string, SlackWorkspaceUser>): Promise<RepositorySyncCounts> {
    const prisma = getPrismaClient();
    const contributors = await this.githubService.getRepositoryContributors(repository.githubInstallationId, repository.owner, repository.name);
    const profilesByLogin = await this.collectCommitProfiles(repository);

    const existingRows = await prisma.contributor.findMany({
      where: { githubUserId: { in: contributors.map((contributor) => contributor.id) } },
      select: { id: true, githubUserId: true, emails: true, primaryEmail: true, name: true, slackUserId: true, userId: true, lastActiveAt: true },
    });
    const existingByGithubId = new Map(existingRows.map((row) => [row.githubUserId, row]));

    // Two GitHub accounts can share a commit email; a Slack member must not be auto-linked twice.
    const claimedSlackIds = new Set(
      (await prisma.contributor.findMany({ where: { slackUserId: { not: null } }, select: { slackUserId: true } })).map((row) => row.slackUserId as string)
    );

    const counts: RepositorySyncCounts = { created: [], updated: [], slackLinked: 0 };

    for (const contributor of contributors) {
      const isBot = contributor.type === 'Bot' || contributor.login.endsWith('[bot]');
      const profile = profilesByLogin.get(contributor.login.toLowerCase());
      const existing = existingByGithubId.get(contributor.id);

      const mergedEmails = Array.from(new Set([...(existing?.emails ?? []), ...(profile?.emails ?? [])])).sort();
      const primaryEmail = mergedEmails.find((email) => !email.endsWith(NOREPLY_EMAIL_SUFFIX)) ?? existing?.primaryEmail ?? null;
      const name = profile?.name ?? existing?.name ?? null;
      const lastActiveAt = this.latestDate(profile?.lastActiveAt ?? null, existing?.lastActiveAt ?? null);

      const slackMatch = this.matchSlackUser(mergedEmails, slackUsersByEmail);
      const shouldAutoLink = Boolean(slackMatch) && !existing?.slackUserId && !claimedSlackIds.has(slackMatch!.id);
      const linkedUserId = primaryEmail && !existing?.userId ? await this.findUserIdByEmail(primaryEmail) : null;

      const shared = {
        githubLogin: contributor.login,
        githubAvatarUrl: contributor.avatar_url,
        githubHtmlUrl: contributor.html_url,
        name,
        primaryEmail,
        emails: mergedEmails,
        isBot,
        lastActiveAt,
        lastSyncedAt: new Date(),
      };

      const record = await prisma.contributor.upsert({
        where: { githubUserId: contributor.id },
        create: {
          githubUserId: contributor.id,
          contributions: contributor.contributions,
          ...shared,
          ...(linkedUserId ? { userId: linkedUserId } : {}),
          ...(shouldAutoLink && slackMatch ? this.slackLinkData(slackMatch, ContributorSlackLinkSource.AUTO_EMAIL, null) : {}),
        },
        update: {
          ...shared,
          ...(linkedUserId ? { userId: linkedUserId } : {}),
          ...(shouldAutoLink && slackMatch ? this.slackLinkData(slackMatch, ContributorSlackLinkSource.AUTO_EMAIL, null) : {}),
        },
      });

      if (existing) {
        counts.updated.push(contributor.id);
      } else {
        counts.created.push(contributor.id);
      }
      if (shouldAutoLink && slackMatch) {
        claimedSlackIds.add(slackMatch.id);
        counts.slackLinked++;
      }

      await prisma.contributorRepository.upsert({
        where: { contributorId_repositoryId: { contributorId: record.id, repositoryId: repository.id } },
        create: { contributorId: record.id, repositoryId: repository.id, contributions: contributor.contributions, lastActiveAt },
        update: { contributions: contributor.contributions, lastActiveAt },
      });
    }

    await this.refreshContributionTotals(contributors.map((contributor) => contributor.id));

    serverLogger.info(
      { repo: repository.fullName, created: counts.created.length, updated: counts.updated.length, slackLinked: counts.slackLinked },
      'Synced contributors for repository'
    );
    return counts;
  }

  /**
   * Harvests author name, emails and last commit date, keyed by GitHub login.
   * The contributors endpoint carries no email, and email is the only reliable join key to Slack.
   */
  private async collectCommitProfiles(repository: PrismaProductRepository): Promise<Map<string, CommitProfile>> {
    const profilesByLogin = new Map<string, CommitProfile>();
    const since = new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

    try {
      const commits = await this.githubService.getCommitsSince(repository.githubInstallationId, repository.owner, repository.name, since, repository.fullName);

      for (const commit of commits) {
        const login = commit.author?.login?.toLowerCase();
        if (!login) continue;

        const profile = profilesByLogin.get(login) ?? { emails: new Set<string>(), name: null, lastActiveAt: null };
        const email = commit.commit?.author?.email;
        if (email) profile.emails.add(email.toLowerCase());
        if (!profile.name && commit.commit?.author?.name) profile.name = commit.commit.author.name;

        const committedAt = commit.commit?.author?.date ? new Date(commit.commit.author.date) : null;
        profile.lastActiveAt = this.latestDate(committedAt, profile.lastActiveAt);

        profilesByLogin.set(login, profile);
      }
    } catch (error) {
      // Best-effort: a contributor without commit metadata is still worth recording.
      serverLogger.warn({ err: error, repo: repository.fullName }, 'Failed to harvest commit author profiles');
    }

    return profilesByLogin;
  }

  private latestDate(a: Date | null, b: Date | null): Date | null {
    if (!a) return b;
    if (!b) return a;
    return a > b ? a : b;
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

  private mapContributor(row: PrismaContributor & { repositories?: ContributorRepositoryRow[] }): ContributorWithRelations {
    const { repositories, ...rest } = row;
    return {
      ...rest,
      slackLinkSource: rest.slackLinkSource as ContributorSlackLinkSource | null,
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
