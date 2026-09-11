// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { RELEASE_JOB_ACTIVE_STATUSES, UserRole } from '@lfx-changelog/shared';

import { AuthorizationError } from '../errors';
import { getPrismaClient } from './prisma.service';

import type { User, UserRoleAssignment } from '@prisma/client';

type DbUser = User & { userRoleAssignments?: UserRoleAssignment[] };

export class ReleaseAuthService {
  public isSuperAdmin(user: DbUser | null | undefined): boolean {
    return this.roles(user).some((assignment) => assignment.role === UserRole.SUPER_ADMIN);
  }

  public canSeeReleases(user: DbUser | null | undefined): boolean {
    return this.roles(user).some((assignment) => {
      const role = assignment.role as UserRole;
      return role === UserRole.SUPER_ADMIN || role === UserRole.PRODUCT_ADMIN;
    });
  }

  public assertCanSeeReleases(user: DbUser | null | undefined): void {
    if (!this.canSeeReleases(user)) {
      throw new AuthorizationError('Release pages require a product admin or super admin role');
    }
  }

  public async canReleaseService(user: DbUser | null | undefined, serviceKey: string): Promise<boolean> {
    if (!user) {
      return false;
    }
    if (this.isSuperAdmin(user)) {
      return true;
    }
    const productId = await this.mappedProductId(serviceKey);
    if (!productId) {
      return false;
    }
    return this.roles(user).some((assignment) => {
      if (assignment.role !== UserRole.PRODUCT_ADMIN) {
        return false;
      }
      return assignment.productId === null || assignment.productId === productId;
    });
  }

  public async assertCanReleaseService(user: DbUser | null | undefined, serviceKey: string): Promise<void> {
    if (!(await this.canReleaseService(user, serviceKey))) {
      throw new AuthorizationError(`You cannot start a release for ${serviceKey}`);
    }
  }

  public async visibleServiceKeys(user: DbUser | null | undefined): Promise<string[] | 'all'> {
    if (this.isSuperAdmin(user)) {
      return 'all';
    }
    if (this.hasGlobalProductAdmin(user)) {
      const prisma = getPrismaClient();
      const mappings = await prisma.releasableServiceMapping.findMany({ select: { serviceKey: true } });
      return mappings.map((row) => row.serviceKey);
    }
    const productIds = this.administeredProductIds(user);
    if (productIds.length === 0) {
      return [];
    }
    const prisma = getPrismaClient();
    const mappings = await prisma.releasableServiceMapping.findMany({
      where: { productId: { in: productIds } },
      select: { serviceKey: true },
    });
    return mappings.map((row) => row.serviceKey);
  }

  public administeredProductIds(user: DbUser | null | undefined): string[] {
    const roles = this.roles(user);
    if (roles.some((assignment) => assignment.role === UserRole.PRODUCT_ADMIN && assignment.productId === null)) {
      return [];
    }
    return roles.filter((assignment) => assignment.role === UserRole.PRODUCT_ADMIN && assignment.productId).map((assignment) => assignment.productId as string);
  }

  public hasGlobalProductAdmin(user: DbUser | null | undefined): boolean {
    return this.roles(user).some((assignment) => assignment.role === UserRole.PRODUCT_ADMIN && assignment.productId === null);
  }

  public async mappedProductId(serviceKey: string): Promise<string | null> {
    const prisma = getPrismaClient();
    const mapping = await prisma.releasableServiceMapping.findUnique({
      where: { serviceKey },
      select: { productId: true },
    });
    return mapping?.productId ?? null;
  }

  public async findActiveJob(serviceKey: string): Promise<{ id: string; status: string } | null> {
    const prisma = getPrismaClient();
    return prisma.releaseJob.findFirst({
      where: {
        serviceKey,
        status: { in: [...RELEASE_JOB_ACTIVE_STATUSES] },
      },
      select: { id: true, status: true },
    });
  }

  private roles(user: DbUser | null | undefined): UserRoleAssignment[] {
    return user?.userRoleAssignments ?? [];
  }
}

export const releaseAuthService = new ReleaseAuthService();
