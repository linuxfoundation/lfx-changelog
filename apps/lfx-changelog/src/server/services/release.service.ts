// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { bumpPatchVersion, hasMinimumRole, UserRole } from '@lfx-changelog/shared';

import { NotFoundError } from '../errors';
import { serverLogger } from '../server-logger';
import { GitHubService } from './github.service';
import { getPrismaClient } from './prisma.service';

import type { CreateReleaseRequest, GeneratedReleaseNotes, GitHubRelease, ReleaseTarget } from '@lfx-changelog/shared';
import type { ProductRepository as PrismaProductRepository, UserRoleAssignment } from '@prisma/client';

/** The authenticated user, as hybridAuthMiddleware attaches it. */
type Actor = { id: string; userRoleAssignments?: UserRoleAssignment[] };

export class ReleaseService {
  private readonly githubService = new GitHubService();

  /**
   * Everything the create-release form needs for one repository: the default branch to target,
   * the branch list to choose from, and a suggested next tag derived from the newest release
   * already stored for that repository.
   */
  public async getReleaseTarget(repositoryId: string, actor: Actor): Promise<ReleaseTarget> {
    const repository = await this.requireReleasableRepository(repositoryId, actor);

    const [defaultBranch, branches, latest] = await Promise.all([
      this.githubService.getRepositoryDefaultBranch(repository.githubInstallationId, repository.owner, repository.name),
      this.githubService.listBranches(repository.githubInstallationId, repository.owner, repository.name),
      this.findLatestTag(repository.id),
    ]);

    return {
      repositoryId: repository.id,
      fullName: repository.fullName,
      defaultBranch,
      latestTag: latest,
      suggestedTag: this.suggestNextTag(latest),
      branches,
    };
  }

  /** GitHub's generated notes for a prospective release, so the author edits rather than writes. */
  public async previewNotes(repositoryId: string, tagName: string, targetCommitish: string, actor: Actor): Promise<GeneratedReleaseNotes> {
    const repository = await this.requireReleasableRepository(repositoryId, actor);
    const previousTagName = await this.findLatestTag(repository.id);

    return this.githubService.generateReleaseNotes(repository.githubInstallationId, repository.owner, repository.name, {
      tagName,
      targetCommitish,
      ...(previousTagName ? { previousTagName } : {}),
    });
  }

  /**
   * Publishes a release on GitHub. Nothing is written here — the `release.published` webhook
   * stores the row, which keeps this path and an externally created release identical.
   */
  public async createRelease(repositoryId: string, data: CreateReleaseRequest, actor: Actor): Promise<GitHubRelease> {
    const repository = await this.requireReleasableRepository(repositoryId, actor);

    const release = await this.githubService.createRelease(repository.githubInstallationId, repository.owner, repository.name, {
      tagName: data.tagName,
      targetCommitish: data.targetCommitish,
      name: data.name,
      body: data.body,
      prerelease: data.prerelease,
    });

    serverLogger.info({ repositoryId, repo: repository.fullName, tagName: data.tagName, requestedBy: actor.id }, 'Release published from the admin UI');
    return release;
  }

  // ── Private helpers ─────────────────────────

  /**
   * Loads a tracked repository and checks the actor administers the product that owns it.
   *
   * A missing repository and one outside the actor's products both surface as 404, so the
   * endpoint cannot be used to discover which repositories exist.
   */
  private async requireReleasableRepository(repositoryId: string, actor: Actor): Promise<PrismaProductRepository> {
    const prisma = getPrismaClient();
    const repository = await prisma.productRepository.findUnique({ where: { id: repositoryId } });
    if (!repository) {
      throw new NotFoundError(`Repository not found: ${repositoryId}`, { operation: 'requireReleasableRepository', service: 'release' });
    }

    const assignments = (actor.userRoleAssignments ?? []) as unknown as Parameters<typeof hasMinimumRole>[0];
    if (!hasMinimumRole(assignments, UserRole.PRODUCT_ADMIN, repository.productId)) {
      throw new NotFoundError(`Repository not found: ${repositoryId}`, { operation: 'requireReleasableRepository', service: 'release' });
    }

    return repository;
  }

  /** Newest published tag already stored for the repository, used for both the suggestion and the notes window. */
  private async findLatestTag(repositoryId: string): Promise<string | null> {
    const prisma = getPrismaClient();
    const latest = await prisma.gitHubRelease.findFirst({
      where: { repositoryId, isDraft: false },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      select: { tagName: true },
    });

    return latest?.tagName ?? null;
  }

  /** Keeps the `v` prefix when the previous tag used one, since a repository's tags should stay consistent. */
  private suggestNextTag(latestTag: string | null): string {
    const next = bumpPatchVersion(latestTag);
    return latestTag?.trim().toLowerCase().startsWith('v') ? `v${next}` : next;
  }
}
