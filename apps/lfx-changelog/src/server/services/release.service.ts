// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { serverLogger } from '../server-logger';

import { GitHubService } from './github.service';
import { getPrismaClient } from './prisma.service';
import { ProductRepositoryService } from './product-repository.service';

import type { StoredRelease } from '@lfx-changelog/shared';
import type { ProductRepository as PrismaProductRepository } from '@prisma/client';

interface FindAllPublicOptions {
  limit?: number;
  productId?: string;
}

interface GitHubReleasePayload {
  id: number;
  tag_name: string;
  name: string | null;
  html_url: string;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  author: { login: string; avatar_url: string };
}

export class ReleaseService {
  private readonly githubService = new GitHubService();
  private readonly productRepositoryService = new ProductRepositoryService();

  public async findAllPublic(options: FindAllPublicOptions = {}): Promise<StoredRelease[]> {
    const prisma = getPrismaClient();
    const limit = Math.min(options.limit || 20, 100);

    const releases = await prisma.gitHubRelease.findMany({
      where: {
        isDraft: false,
        ...(options.productId && {
          repository: { productId: options.productId },
        }),
      },
      include: {
        repository: {
          include: { product: true },
        },
      },
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });

    return releases.map((r) => ({
      id: r.id,
      tagName: r.tagName,
      name: r.name,
      htmlUrl: r.htmlUrl,
      body: r.body,
      isDraft: r.isDraft,
      isPrerelease: r.isPrerelease,
      publishedAt: r.publishedAt?.toISOString() ?? null,
      authorLogin: r.authorLogin,
      authorAvatarUrl: r.authorAvatarUrl,
      repositoryFullName: r.repository.fullName,
      productId: r.repository.product.id,
      productName: r.repository.product.name,
      productSlug: r.repository.product.slug,
      productFaIcon: r.repository.product.faIcon,
    }));
  }

  public async syncForProduct(productId: string): Promise<number> {
    const repos = await this.productRepositoryService.findByProductId(productId);
    serverLogger.info({ productId, repoCount: repos.length }, 'Syncing releases for product');

    let totalSynced = 0;
    for (const repo of repos) {
      try {
        const count = await this.syncForRepository(repo);
        totalSynced += count;
      } catch (error) {
        serverLogger.error({ repo: repo.fullName, error }, 'Failed to sync releases for repository');
      }
    }

    serverLogger.info({ productId, totalSynced }, 'Finished syncing releases for product');
    return totalSynced;
  }

  public async syncForRepository(repo: PrismaProductRepository): Promise<number> {
    const releases = await this.githubService.getRepositoryReleases(repo.githubInstallationId, repo.owner, repo.name, repo.fullName);

    const prisma = getPrismaClient();
    let synced = 0;

    for (const release of releases) {
      await prisma.gitHubRelease.upsert({
        where: {
          repositoryId_githubId: {
            repositoryId: repo.id,
            githubId: release.id,
          },
        },
        create: {
          repositoryId: repo.id,
          githubId: release.id,
          tagName: release.tag_name,
          name: release.name,
          htmlUrl: release.html_url,
          body: release.body,
          isDraft: release.draft,
          isPrerelease: release.prerelease,
          publishedAt: release.published_at ? new Date(release.published_at) : null,
          authorLogin: release.author.login,
          authorAvatarUrl: release.author.avatar_url,
        },
        update: {
          tagName: release.tag_name,
          name: release.name,
          htmlUrl: release.html_url,
          body: release.body,
          isDraft: release.draft,
          isPrerelease: release.prerelease,
          publishedAt: release.published_at ? new Date(release.published_at) : null,
          authorLogin: release.author.login,
          authorAvatarUrl: release.author.avatar_url,
        },
      });
      synced++;
    }

    await prisma.productRepository.update({
      where: { id: repo.id },
      data: { lastSyncedAt: new Date() },
    });

    serverLogger.info({ repo: repo.fullName, synced }, 'Synced releases for repository');
    return synced;
  }

  public async upsertFromWebhook(repositoryId: string, payload: GitHubReleasePayload): Promise<void> {
    const prisma = getPrismaClient();

    await prisma.gitHubRelease.upsert({
      where: {
        repositoryId_githubId: {
          repositoryId,
          githubId: payload.id,
        },
      },
      create: {
        repositoryId,
        githubId: payload.id,
        tagName: payload.tag_name,
        name: payload.name,
        htmlUrl: payload.html_url,
        body: payload.body,
        isDraft: payload.draft,
        isPrerelease: payload.prerelease,
        publishedAt: payload.published_at ? new Date(payload.published_at) : null,
        authorLogin: payload.author.login,
        authorAvatarUrl: payload.author.avatar_url,
      },
      update: {
        tagName: payload.tag_name,
        name: payload.name,
        htmlUrl: payload.html_url,
        body: payload.body,
        isDraft: payload.draft,
        isPrerelease: payload.prerelease,
        publishedAt: payload.published_at ? new Date(payload.published_at) : null,
        authorLogin: payload.author.login,
        authorAvatarUrl: payload.author.avatar_url,
      },
    });

    serverLogger.info({ repositoryId, githubId: payload.id, tag: payload.tag_name }, 'Upserted release from webhook');
  }
}
