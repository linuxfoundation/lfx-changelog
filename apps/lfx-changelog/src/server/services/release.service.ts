// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { bumpPatchVersion, ROLE_HIERARCHY, UserRole } from '@lfx-changelog/shared';

import { ConflictError, NotFoundError } from '../errors';
import { serverLogger } from '../server-logger';
import { GitHubService } from './github.service';
import { getPrismaClient } from './prisma.service';

import type { CreateReleaseRequest, GeneratedReleaseNotes, GitHubRelease, ReleaseTarget } from '@lfx-changelog/shared';
import type { ProductRepository as PrismaProductRepository, UserRoleAssignment } from '@prisma/client';

export class ReleaseService {
  private readonly githubService = new GitHubService();

  public async getReleaseTarget(repositoryId: string, userRoles: UserRoleAssignment[]): Promise<ReleaseTarget> {
    const repository = await this.requireReleasableRepository(repositoryId, userRoles);

    const [defaultBranch, branches, latestTag] = await Promise.all([
      this.githubService.getRepositoryDefaultBranch(repository.githubInstallationId, repository.owner, repository.name),
      this.githubService.listBranches(repository.githubInstallationId, repository.owner, repository.name),
      this.findLatestTag(repository.id),
    ]);

    return {
      repositoryId: repository.id,
      fullName: repository.fullName,
      defaultBranch,
      latestTag,
      suggestedTag: this.suggestNextTag(latestTag),
      branches,
    };
  }

  public async previewNotes(repositoryId: string, tagName: string, targetCommitish: string, userRoles: UserRoleAssignment[]): Promise<GeneratedReleaseNotes> {
    const repository = await this.requireReleasableRepository(repositoryId, userRoles);
    const previousTagName = await this.findLatestTag(repository.id);

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

    const release = await this.githubService.createRelease(repository.githubInstallationId, repository.owner, repository.name, {
      tagName: data.tagName,
      targetCommitish: data.targetCommitish,
      name: data.name,
      body: data.body,
      prerelease: data.prerelease,
    });

    serverLogger.info({ repositoryId, repo: repository.fullName, tagName: data.tagName, requestedBy: userId }, 'Release published from the admin UI');
    return release;
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

  private async findLatestTag(repositoryId: string): Promise<string | null> {
    const prisma = getPrismaClient();
    const latest = await prisma.gitHubRelease.findFirst({
      where: { repositoryId, isDraft: false },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      select: { tagName: true },
    });

    return latest?.tagName ?? null;
  }

  private suggestNextTag(latestTag: string | null): string {
    const next = bumpPatchVersion(latestTag);
    return latestTag?.trim().toLowerCase().startsWith('v') ? `v${next}` : next;
  }
}
