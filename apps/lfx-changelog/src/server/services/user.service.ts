// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Prisma, UserRoleAssignment as PrismaRoleAssignment, User as PrismaUser, UserRole as PrismaUserRole } from '@prisma/client';

import { AuthorizationError, ConflictError, NotFoundError } from '../errors';
import { serverLogger } from '../server-logger';

import { getPrismaClient } from './prisma.service';
import { SearchService, toBlogDocument } from './search.service';

const USER_INCLUDE = { userRoleAssignments: { include: { product: true } } } as const;

export class UserService {
  private readonly searchService = new SearchService();

  public async findByEmail(email: string): Promise<PrismaUser | null> {
    const prisma = getPrismaClient();
    return prisma.user.findUnique({
      where: { email },
      include: USER_INCLUDE,
    });
  }

  public async create(data: { email: string; name: string }): Promise<PrismaUser> {
    const prisma = getPrismaClient();
    try {
      return await prisma.user.create({
        data: { email: data.email, name: data.name },
        include: USER_INCLUDE,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError(`User with email ${data.email} already exists`, { operation: 'create', service: 'user' });
      }
      throw error;
    }
  }

  public async createWithRole(data: { email: string; name: string; role: string; productId?: string; productIds?: string[] }): Promise<PrismaUser> {
    const prisma = getPrismaClient();
    let resolvedProductIds: (string | null)[] = [null];
    if (data.productIds?.length) {
      resolvedProductIds = data.productIds;
    } else if (data.productId) {
      resolvedProductIds = [data.productId];
    }
    try {
      return await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email: data.email, name: data.name },
        });
        await tx.userRoleAssignment.createMany({
          data: resolvedProductIds.map((pid) => ({
            userId: user.id,
            role: data.role as PrismaUserRole,
            productId: pid || null,
          })),
        });
        return tx.user.findUniqueOrThrow({
          where: { id: user.id },
          include: USER_INCLUDE,
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError(`User with email ${data.email} already exists`, { operation: 'createWithRole', service: 'user' });
      }
      throw error;
    }
  }

  public async findById(id: string): Promise<PrismaUser> {
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({
      where: { id },
      include: USER_INCLUDE,
    });
    if (!user) {
      throw new NotFoundError(`User not found: ${id}`, { operation: 'findById', service: 'user' });
    }
    return user;
  }

  public async findByAuth0Id(auth0Id: string): Promise<PrismaUser | null> {
    const prisma = getPrismaClient();
    return prisma.user.findUnique({
      where: { auth0Id },
      include: USER_INCLUDE,
    });
  }

  public async findAll(): Promise<PrismaUser[]> {
    const prisma = getPrismaClient();
    return prisma.user.findMany({
      include: USER_INCLUDE,
      orderBy: { name: 'asc' },
    });
  }

  public async assignRole(userId: string, role: string, productId: string | null): Promise<PrismaRoleAssignment> {
    const prisma = getPrismaClient();
    await this.findById(userId);
    return prisma.userRoleAssignment.create({
      data: {
        userId,
        role: role as PrismaUserRole,
        productId,
      },
      include: { product: true },
    });
  }

  public async assignRoles(userId: string, role: string, productIds: string[]): Promise<PrismaUser> {
    const prisma = getPrismaClient();
    await this.findById(userId);
    await prisma.$transaction(async (tx) => {
      await tx.userRoleAssignment.createMany({
        data: productIds.map((pid) => ({
          userId,
          role: role as PrismaUserRole,
          productId: pid || null,
        })),
        skipDuplicates: true,
      });
    });
    return this.findById(userId);
  }

  public async removeRole(roleId: string): Promise<void> {
    const prisma = getPrismaClient();
    const assignment = await prisma.userRoleAssignment.findUnique({ where: { id: roleId } });
    if (!assignment) {
      throw new NotFoundError(`Role assignment not found: ${roleId}`, { operation: 'removeRole', service: 'user' });
    }
    await prisma.userRoleAssignment.delete({ where: { id: roleId } });
  }

  public async delete(id: string, callerId: string): Promise<void> {
    const prisma = getPrismaClient();
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundError(`User not found: ${id}`, { operation: 'delete', service: 'user' });
    }

    const superAdminCount = await prisma.user.count({
      where: { userRoleAssignments: { some: { role: PrismaUserRole.super_admin } } },
    });
    const targetIsSuperAdmin =
      (await prisma.userRoleAssignment.count({
        where: { userId: id, role: PrismaUserRole.super_admin },
      })) > 0;

    // Last-Super-Admin is checked before self so a sole Super Admin deleting themselves
    // is 409 (org invariant) rather than 403. Self-delete with other Super Admins remaining is 403.
    if (targetIsSuperAdmin && superAdminCount <= 1) {
      throw new ConflictError('The last Super Admin cannot be removed', { operation: 'delete', service: 'user' });
    }

    if (id === callerId) {
      throw new AuthorizationError('You cannot remove your own account', { operation: 'delete', service: 'user' });
    }

    const snapshotName = target.name.trim() || 'Former user';
    const snapshotAvatar = target.avatarUrl;

    const authoredBlogs = await prisma.blog.findMany({
      where: { createdBy: id, status: 'published' },
      include: { products: { include: { product: { select: { id: true, name: true } } } } },
    });

    await prisma.$transaction(async (tx) => {
      await tx.changelogEntry.updateMany({
        where: { createdBy: id },
        data: { authorName: snapshotName, authorAvatarUrl: snapshotAvatar },
      });
      await tx.blog.updateMany({
        where: { createdBy: id },
        data: { authorName: snapshotName, authorAvatarUrl: snapshotAvatar },
      });
      await tx.user.delete({ where: { id } });
    });

    for (const blog of authoredBlogs) {
      this.searchService
        .indexBlogDocument(
          toBlogDocument({
            ...blog,
            author: null,
            authorName: snapshotName,
            authorAvatarUrl: snapshotAvatar,
          })
        )
        .catch((err) => serverLogger.warn({ err, id: blog.id }, 'Failed to update blog author in OpenSearch after user delete'));
    }
  }
}
