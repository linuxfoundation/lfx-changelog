// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { ContributorSlackLinkSource, DEFAULT_LOOKBACK_DAYS, MAX_PAGE_SIZE } from '@lfx-changelog/shared';
import { Prisma } from '@prisma/client';

import { ConflictError, NotFoundError } from '../errors';
import { recalculateContributorTotals } from '../helpers/contributor-totals.helper';
import { serverLogger } from '../server-logger';
import { GitHubService } from './github.service';
import { getPrismaClient } from './prisma.service';
import { SlackService } from './slack.service';

import type {
  ContributorQueryParams,
  ContributorSyncResult,
  ContributorWithRelations,
  GitHubContributor,
  PaginatedResponse,
  SlackWorkspaceUser,
} from '@lfx-changelog/shared';
import type { Contributor as PrismaContributor, ProductRepository as PrismaProductRepository } from '@prisma/client';
import type { CommitProfile, CommitProfileHarvest, ContributorRepositoryRow, RepositorySyncCounts } from '../interfaces/contributor.interface';

/** GitHub's privacy-preserving commit addresses can never match a real Slack account. */
const NOREPLY_EMAIL_SUFFIX = '@users.noreply.github.com';

/**
 * Commits read per repository when harvesting emails. Above GitHubService's 500 default so a
 * busy repository doesn't lose older commits inside the lookback window; bounded rather than
 * unlimited, and the sync reports when the cap is reached.
 */
const COMMIT_HARVEST_LIMIT = 5000;

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

    // Single-member lookup rather than pulling the whole directory to validate one ID.
    const slackUser = await this.slackService.findWorkspaceUser(slackUserId);
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

    try {
      const updated = await prisma.contributor.update({
        where: { id },
        data: this.slackLinkData(slackUser, ContributorSlackLinkSource.MANUAL, linkedById),
        include: CONTRIBUTOR_REPOSITORY_INCLUDE,
      });

      serverLogger.info({ contributorId: id, slackUserId, linkedById }, 'Contributor linked to Slack user');
      return this.mapContributor(updated);
    } catch (error) {
      // The check above is not atomic — concurrent links race to the unique index.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError(`Slack user ${slackUserId} is already linked to another contributor`, {
          operation: 'linkSlack',
          service: 'contributor',
        });
      }
      throw error;
    }
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

  /**
   * Permanently removes a contributor and its repository links.
   *
   * Contributor data is entirely derived from GitHub, so deletion loses nothing authoritative —
   * a later sync of a tracked repository will recreate the row. It exists so an erasure request
   * can be honoured, and so a record can be dropped once its repositories are no longer tracked.
   */
  public async delete(id: string): Promise<void> {
    const prisma = getPrismaClient();
    await this.requireContributor(id);

    await prisma.contributor.delete({ where: { id } });
    serverLogger.info({ contributorId: id }, 'Contributor deleted');
  }

  // ── Sync ────────────────────────────────────

  /**
   * Pulls contributors from tracked repositories, enriches them from commit history, and
   * attempts an email-based Slack match. A failing repository is recorded, not fatal.
   */
  public async sync(options: { productId?: string; repositoryId?: string }): Promise<ContributorSyncResult> {
    // Route validation enforces this; the guard covers internal callers, since an unscoped
    // sync would crawl every tracked repository inline in the request.
    if (Boolean(options.productId) === Boolean(options.repositoryId)) {
      throw new Error('Contributor sync requires exactly one of productId or repositoryId');
    }

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

    // Loaded once and mutated as links are made — the set does not change from anything
    // other than this sync, so re-reading it per repository was redundant.
    const claimedSlackIds = new Set(
      (await prisma.contributor.findMany({ where: { slackUserId: { not: null } }, select: { slackUserId: true } })).map((row) => row.slackUserId as string)
    );

    // Keyed by GitHub user ID, not summed per repository — one person in five repos is one contributor.
    const createdIds = new Set<number>();
    const updatedIds = new Set<number>();

    for (const repository of repositories) {
      try {
        const counts = await this.syncRepository(repository, slackUsersByEmail, claimedSlackIds);
        result.repositoriesScanned++;
        counts.created.forEach((id) => createdIds.add(id));
        counts.updated.forEach((id) => updatedIds.add(id));
        result.slackAutoLinked += counts.slackLinked;
        result.errors.push(...counts.warnings);
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

  private async syncRepository(
    repository: PrismaProductRepository,
    slackUsersByEmail: Map<string, SlackWorkspaceUser>,
    claimedSlackIds: Set<string>
  ): Promise<RepositorySyncCounts> {
    const prisma = getPrismaClient();
    const contributors = await this.githubService.getRepositoryContributors(repository.githubInstallationId, repository.owner, repository.name);
    const { profilesByLogin, warnings } = await this.collectCommitProfiles(repository);

    const existingRows = await prisma.contributor.findMany({
      where: { githubUserId: { in: contributors.map((contributor) => contributor.id) } },
      select: { id: true, githubUserId: true, emails: true, primaryEmail: true, name: true, slackUserId: true, lastActiveAt: true },
    });
    const existingByGithubId = new Map(existingRows.map((row) => [row.githubUserId, row]));

    const counts: RepositorySyncCounts = { created: [], updated: [], slackLinked: 0, warnings };

    for (const contributor of contributors) {
      const isBot = contributor.type === 'Bot' || contributor.login.endsWith('[bot]');
      const profile = profilesByLogin.get(contributor.login.toLowerCase());
      const existing = existingByGithubId.get(contributor.id);

      const mergedEmails = Array.from(new Set([...(existing?.emails ?? []), ...(profile?.emails ?? [])])).sort();
      const primaryEmail = mergedEmails.find((email) => !email.endsWith(NOREPLY_EMAIL_SUFFIX)) ?? existing?.primaryEmail ?? null;
      const name = profile?.name ?? existing?.name ?? null;
      // Contributor.lastActiveAt is the cross-repository maximum; the link row below must carry
      // only this repository's date, or activity in one repo leaks into another's relation.
      const repoLastActiveAt = profile?.lastActiveAt ?? null;
      const lastActiveAt = this.latestDate(repoLastActiveAt, existing?.lastActiveAt ?? null);

      const slackMatch = this.matchSlackUser(mergedEmails, slackUsersByEmail);
      const shouldAutoLink = Boolean(slackMatch) && !existing?.slackUserId && !claimedSlackIds.has(slackMatch!.id);

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
        create: { githubUserId: contributor.id, contributions: contributor.contributions, ...shared },
        update: shared,
      });

      // Applied separately and conditionally on slackUserId IS NULL. `existing` is a snapshot
      // taken before this loop, so a manual link made mid-sync would otherwise be overwritten.
      let linked = false;
      if (shouldAutoLink && slackMatch) {
        try {
          const claimed = await prisma.contributor.updateMany({
            where: { id: record.id, slackUserId: null },
            data: this.slackLinkData(slackMatch, ContributorSlackLinkSource.AUTO_EMAIL, null),
          });
          linked = claimed.count > 0;
        } catch (error) {
          // Another row claimed this Slack member since claimedSlackIds was read. That is a
          // failed auto-link, not a failed sync — record it and keep going.
          if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
          claimedSlackIds.add(slackMatch.id);
          serverLogger.warn({ contributorId: record.id, slackUserId: slackMatch.id }, 'Slack member claimed concurrently — skipping auto-link');
        }
      }

      if (existing) {
        counts.updated.push(contributor.id);
      } else {
        counts.created.push(contributor.id);
      }
      if (linked && slackMatch) {
        claimedSlackIds.add(slackMatch.id);
        counts.slackLinked++;
      }

      await prisma.contributorRepository.upsert({
        where: { contributorId_repositoryId: { contributorId: record.id, repositoryId: repository.id } },
        create: { contributorId: record.id, repositoryId: repository.id, contributions: contributor.contributions, lastActiveAt: repoLastActiveAt },
        // Only overwrite when this run actually harvested a date — otherwise a lookback window
        // that no longer reaches their last commit would wipe a known date.
        update: { contributions: contributor.contributions, ...(repoLastActiveAt ? { lastActiveAt: repoLastActiveAt } : {}) },
      });
    }

    const staleIds = await this.removeStaleRepositoryLinks(repository.id, contributors);
    await this.refreshContributionTotals(
      contributors.map((contributor) => contributor.id),
      staleIds
    );

    serverLogger.info(
      { repo: repository.fullName, created: counts.created.length, updated: counts.updated.length, slackLinked: counts.slackLinked, unlinked: staleIds.length },
      'Synced contributors for repository'
    );
    return counts;
  }

  /**
   * Drops links for contributors GitHub no longer reports for this repository, so the product
   * filter and commit totals don't retain rows that have gone (including an emptied repository,
   * which returns 204 and therefore no contributors at all). Returns the affected contributor IDs.
   */
  private async removeStaleRepositoryLinks(repositoryId: string, contributors: GitHubContributor[]): Promise<string[]> {
    const prisma = getPrismaClient();
    const keep = contributors.map((contributor) => contributor.id);

    const stale = await prisma.contributorRepository.findMany({
      where: { repositoryId, contributor: { githubUserId: { notIn: keep } } },
      select: { id: true, contributorId: true },
    });
    if (stale.length === 0) return [];

    await prisma.contributorRepository.deleteMany({ where: { id: { in: stale.map((link) => link.id) } } });
    return stale.map((link) => link.contributorId);
  }

  /**
   * Harvests author name, emails and last commit date, keyed by GitHub login.
   * The contributors endpoint carries no email, and email is the only reliable join key to Slack.
   */
  private async collectCommitProfiles(repository: PrismaProductRepository): Promise<CommitProfileHarvest> {
    const profilesByLogin = new Map<string, CommitProfile>();
    const warnings: string[] = [];
    const since = new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

    try {
      const commits = await this.githubService.getCommitsSince(
        repository.githubInstallationId,
        repository.owner,
        repository.name,
        since,
        repository.fullName,
        COMMIT_HARVEST_LIMIT
      );

      // Hitting the cap means older commits in the window were never read, so some
      // contributors will lack an email and silently miss auto-linking. Say so.
      if (commits.length >= COMMIT_HARVEST_LIMIT) {
        warnings.push(`${repository.fullName}: commit harvest hit the ${COMMIT_HARVEST_LIMIT}-commit cap; some contributors may be missing emails`);
      }

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
      // Best-effort: a contributor without commit metadata is still worth recording, but the
      // sync must not report success as though enrichment and auto-linking had run.
      const message = error instanceof Error ? error.message : String(error);
      serverLogger.warn({ err: error, repo: repository.fullName }, 'Failed to harvest commit author profiles');
      warnings.push(`${repository.fullName}: commit harvest failed (${message}); emails and Slack auto-matching were skipped`);
    }

    return { profilesByLogin, warnings };
  }

  private latestDate(a: Date | null, b: Date | null): Date | null {
    if (!a) return b;
    if (!b) return a;
    return a > b ? a : b;
  }

  private async loadSlackUsersByEmail(result: ContributorSyncResult): Promise<Map<string, SlackWorkspaceUser>> {
    const byEmail = new Map<string, SlackWorkspaceUser>();
    try {
      const users = await this.slackService.listWorkspaceUsersForMatching();
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
      // real_name and display_name are both optional in Slack; name always exists, and the
      // contributor table renders only these two fields — without the fallback it shows blank.
      slackDisplayName: slackUser.displayName ?? slackUser.name,
      slackRealName: slackUser.realName,
      slackAvatarUrl: slackUser.avatarUrl,
      slackLinkSource: source,
      slackLinkedAt: new Date(),
      slackLinkedById: linkedById,
    };
  }

  /** Rolls the per-repository contribution counts up onto the contributor row. */
  private async refreshContributionTotals(githubUserIds: number[], contributorIds: string[] = []): Promise<void> {
    if (githubUserIds.length === 0 && contributorIds.length === 0) return;
    const prisma = getPrismaClient();

    const rows = await prisma.contributor.findMany({
      where: { OR: [{ githubUserId: { in: githubUserIds } }, { id: { in: contributorIds } }] },
      select: { id: true },
    });

    await recalculateContributorTotals(
      prisma,
      rows.map((row) => row.id)
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

    // Both constraints applied to the same relation, so a mismatched pair yields the empty
    // intersection the request expresses rather than silently ignoring productId.
    if (params.repositoryId || params.productId) {
      where.repositories = {
        some: {
          ...(params.repositoryId ? { repositoryId: params.repositoryId } : {}),
          ...(params.productId ? { repository: { productId: params.productId } } : {}),
        },
      };
    }

    if (params.query) {
      where.OR = [
        { githubLogin: { contains: params.query, mode: 'insensitive' } },
        { name: { contains: params.query, mode: 'insensitive' } },
        { primaryEmail: { contains: params.query, mode: 'insensitive' } },
        { slackRealName: { contains: params.query, mode: 'insensitive' } },
        // Postgres array membership is exact — substring matching only applies to the scalar fields.
        { emails: { has: params.query.toLowerCase() } },
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
