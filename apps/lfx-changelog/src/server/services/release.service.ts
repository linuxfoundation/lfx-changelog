// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { bumpPatchVersion, ROLE_HIERARCHY, UserRole } from '@lfx-changelog/shared';

import { ConflictError, GitHubApiError, NotFoundError } from '../errors';
import { serverLogger } from '../server-logger';
import { GitHubService } from './github.service';
import { getPrismaClient } from './prisma.service';

import type { CreateReleaseRequest, GeneratedReleaseNotes, GitHubRelease, ReleaseChanges, ReleaseTarget } from '@lfx-changelog/shared';
import type { ProductRepository as PrismaProductRepository, UserRoleAssignment } from '@prisma/client';

export class ReleaseService {
  private readonly githubService = new GitHubService();

  public async getReleaseTarget(repositoryId: string, userRoles: UserRoleAssignment[]): Promise<ReleaseTarget> {
    const repository = await this.requireReleasableRepository(repositoryId, userRoles);

    const [defaultBranch, branches, latest] = await Promise.all([
      this.githubService.getRepositoryDefaultBranch(repository.githubInstallationId, repository.owner, repository.name),
      this.githubService.listBranches(repository.githubInstallationId, repository.owner, repository.name),
      this.findLatestRelease(repository.id),
    ]);

    return {
      repositoryId: repository.id,
      fullName: repository.fullName,
      defaultBranch,
      latestTag: latest?.tagName ?? null,
      latestReleaseUrl: latest?.htmlUrl ?? null,
      suggestedTag: this.suggestNextTag(latest?.tagName ?? null),
      branches,
    };
  }

  public async previewNotes(repositoryId: string, tagName: string, targetCommitish: string, userRoles: UserRoleAssignment[]): Promise<GeneratedReleaseNotes> {
    const repository = await this.requireReleasableRepository(repositoryId, userRoles);
    const previousTagName = (await this.findLatestRelease(repository.id))?.tagName ?? null;

    return this.githubService.generateReleaseNotes(repository.githubInstallationId, repository.owner, repository.name, {
      tagName,
      targetCommitish,
      ...(previousTagName ? { previousTagName } : {}),
    });
  }

  // Nothing is written here — the `release.published` webhook stores the row, which keeps a
  // release published from the UI and one published on GitHub itself on the same path.
  public async createRelease(repositoryId: string, data: CreateReleaseRequest, userRoles: UserRoleAssignment[], userId: string): Promise<GitHubRelease> {
    const repository = await this.requireReleasableRepository(repositoryId, userRoles);

    // GitHub ignores `target_commitish` when the tag already exists, so it would publish at
    // whatever commit the old tag points to rather than the branch the author chose.
    const exists = await this.githubService.tagExists(repository.githubInstallationId, repository.owner, repository.name, data.tagName);
    if (exists) {
      throw new ConflictError(`Tag already exists: ${data.tagName}`, { operation: 'createRelease', service: 'release' });
    }

    let release: GitHubRelease;
    try {
      release = await this.githubService.createRelease(repository.githubInstallationId, repository.owner, repository.name, data);
    } catch (error) {
      // A tag created between the check above and this call still reaches GitHub, which answers
      // 422. Reported as the same conflict so the race cannot produce a different status.
      if (error instanceof GitHubApiError && error.upstreamStatus === 422 && error.upstreamBody?.includes('already_exists')) {
        throw new ConflictError(`Tag already exists: ${data.tagName}`, { operation: 'createRelease', service: 'release' });
      }
      throw error;
    }

    serverLogger.info({ repositoryId, repo: repository.fullName, tagName: data.tagName, requestedBy: userId }, 'Release published from the admin UI');
    return release;
  }

  /**
   * How much has landed on the chosen target since the newest stored release, for the form to
   * show before publishing. Returns nulls rather than failing when there is nothing to compare.
   */
  public async getChanges(repositoryId: string, targetCommitish: string, userRoles: UserRoleAssignment[]): Promise<ReleaseChanges> {
    const repository = await this.requireReleasableRepository(repositoryId, userRoles);
    const latest = await this.findLatestRelease(repository.id);

    if (!latest) {
      return { previousTag: null, previousReleaseUrl: null, totalCommits: null, compareUrl: null };
    }

    const comparison = await this.githubService.getComparison(
      repository.githubInstallationId,
      repository.owner,
      repository.name,
      latest.tagName,
      targetCommitish
    );

    return {
      previousTag: latest.tagName,
      previousReleaseUrl: latest.htmlUrl,
      totalCommits: comparison.totalCommits,
      compareUrl: comparison.compareUrl,
    };
  }

  /** Pulls the repository's releases from GitHub. Scoped the same way publishing is. */
  public async syncRepository(repositoryId: string, userRoles: UserRoleAssignment[]): Promise<number> {
    const repository = await this.requireReleasableRepository(repositoryId, userRoles);
    return this.githubService.syncReleasesForRepository(repository);
  }

  // ── Private helpers ─────────────────────────

  // A repository outside the caller's products reports 404 rather than 403, so the endpoint
  // cannot be used to discover which repositories exist.
  private async requireReleasableRepository(repositoryId: string, userRoles: UserRoleAssignment[]): Promise<PrismaProductRepository> {
    const prisma = getPrismaClient();
    const repository = await prisma.productRepository.findUnique({ where: { id: repositoryId } });

    if (!repository || !this.canAdministerProduct(userRoles, repository.productId)) {
      throw new NotFoundError(`Repository not found: ${repositoryId}`, { operation: 'requireReleasableRepository', service: 'release' });
    }

    return repository;
  }

  private canAdministerProduct(userRoles: UserRoleAssignment[], productId: string): boolean {
    if (userRoles.some((assignment) => assignment.role === UserRole.SUPER_ADMIN)) {
      return true;
    }

    const minimumLevel = ROLE_HIERARCHY[UserRole.PRODUCT_ADMIN];
    return userRoles.some((assignment) => {
      const roleLevel = ROLE_HIERARCHY[assignment.role as UserRole];
      return roleLevel !== undefined && roleLevel >= minimumLevel && (assignment.productId === null || assignment.productId === productId);
    });
  }

  private async findLatestRelease(repositoryId: string): Promise<{ tagName: string; htmlUrl: string } | null> {
    const prisma = getPrismaClient();
    const latest = await prisma.gitHubRelease.findFirst({
      where: { repositoryId, isDraft: false },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      select: { tagName: true, htmlUrl: true },
    });

    return latest ?? null;
  }

  private suggestNextTag(latestTag: string | null): string {
    const next = bumpPatchVersion(latestTag);
    return latestTag?.trim().toLowerCase().startsWith('v') ? `v${next}` : next;
  }
}
