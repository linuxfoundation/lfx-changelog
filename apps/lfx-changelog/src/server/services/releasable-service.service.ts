// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { administeredProductIds } from '@lfx-changelog/shared';

import { getPrismaClient } from './prisma.service';

import type { DeploymentType, ReleasableService } from '@lfx-changelog/shared';
import type { UserRoleAssignment } from '@prisma/client';

export class ReleasableServiceService {
  /**
   * Services the caller may release, newest stored tag included so the list can show what each
   * is currently on. Scoped by the product that owns the repository, the same way publishing is,
   * so a product admin sees only their own and the list cannot be used to enumerate the rest.
   */
  public async findReleasable(userRoles: UserRoleAssignment[]): Promise<ReleasableService[]> {
    const prisma = getPrismaClient();
    const productIds = administeredProductIds(userRoles);

    const services = await prisma.releasableService.findMany({
      where: {
        isActive: true,
        ...(productIds && { repository: { productId: { in: productIds } } }),
      },
      include: {
        repository: {
          include: {
            product: { select: { id: true, name: true } },
            releases: {
              where: { isDraft: false },
              orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
              take: 1,
              select: { tagName: true },
            },
          },
        },
      },
      orderBy: { displayName: 'asc' },
    });

    return services.map((service) => ({
      id: service.id,
      repositoryId: service.repositoryId,
      displayName: service.displayName,
      aliases: service.aliases,
      // Prisma generates its own string-literal union for the enum; cast at the boundary,
      // as contributor.service.ts does for ContributorSlackLinkSource.
      deploymentType: service.deploymentType as DeploymentType,
      appName: service.appName,
      argocdRepo: service.argocdRepo,
      environments: service.environments,
      isActive: service.isActive,
      repositoryFullName: service.repository.fullName,
      repositoryHtmlUrl: service.repository.htmlUrl,
      productId: service.repository.product.id,
      productName: service.repository.product.name,
      latestTag: service.repository.releases[0]?.tagName ?? null,
    }));
  }
}
