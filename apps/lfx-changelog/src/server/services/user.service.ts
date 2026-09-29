// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { BOT_EMAIL } from '@lfx-changelog/shared';
import { Prisma, UserRoleAssignment as PrismaRoleAssignment, User as PrismaUser, UserRole as PrismaUserRole } from '@prisma/client';

import { AuthorizationError, ConflictError, NotFoundError } from '../errors';
import { serverLogger } from '../server-logger';

import { getPrismaClient } from './prisma.service';
import { SearchService, toBlogDocument } from './search.service';

import type { UpdateUserRequest } from '@lfx-changelog/shared';

const USER_INCLUDE = { userRoleAssignments: { include: { product: true } } } as const;

export class UserService {
  private readonly searchService = new SearchService();

  public async findByEmail(email: string): Promise<PrismaUser | null> {
    const prisma = getPrismaClient();
    return prisma.user.findUnique({
      where: { email, deactivatedAt: null },
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
        const existing = await prisma.user.findUnique({ where: { email: data.email }, select: { deactivatedAt: true } });
        const message = existing?.deactivatedAt
          ? `User with email ${data.email} is deactivated. Reactivate them from the Users list instead.`
          : `User with email ${data.email} already exists`;
        throw new ConflictError(message, { operation: 'createWithRole', service: 'user' });
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
    await this.findActiveById(userId, 'assignRole');
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
    await this.findActiveById(userId, 'assignRoles');
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

  public async update(id: string, data: UpdateUserRequest, callerId: string): Promise<PrismaUser> {
    const prisma = getPrismaClient();
    const existing = await this.findById(id);
    const emailChanged = data.email !== undefined && data.email !== existing.email;
    if (emailChanged && id === callerId) {
      throw new AuthorizationError('You cannot change your own email', { operation: 'update', service: 'user' });
    }
    if (emailChanged && existing.email === BOT_EMAIL) {
      throw new ConflictError("The automation bot's email cannot be changed", { operation: 'update', service: 'user' });
    }

    let updated: PrismaUser;
    try {
      updated = await prisma.user.update({
        where: { id },
        data: { name: data.name, email: data.email },
        include: USER_INCLUDE,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError(`User with email ${data.email} already exists`, { operation: 'update', service: 'user' });
      }
      throw error;
    }

    serverLogger.info({ userId: id, updatedBy: callerId, fields: Object.keys(data) }, 'User updated');
    if (data.name !== undefined && data.name !== existing.name) {
      this.reindexAuthoredBlogs(id).catch((err) => serverLogger.warn({ err, userId: id }, 'Failed to reindex blogs after user rename'));
    }
    return updated;
  }

  public async deactivate(id: string, callerId: string): Promise<PrismaUser> {
    const prisma = getPrismaClient();
    try {
      // Serializable so two concurrent deactivations can't each count the other as the remaining Super Admin
      await prisma.$transaction(
        async (tx) => {
          const target = await tx.user.findUnique({ where: { id }, include: { userRoleAssignments: true } });
          if (!target) {
            throw new NotFoundError(`User not found: ${id}`, { operation: 'deactivate', service: 'user' });
          }
          if (target.deactivatedAt) return;
          if (id === callerId) {
            throw new AuthorizationError('You cannot deactivate your own account', { operation: 'deactivate', service: 'user' });
          }
          if (target.email === BOT_EMAIL) {
            throw new ConflictError('The automation bot cannot be deactivated', { operation: 'deactivate', service: 'user' });
          }
          if (target.userRoleAssignments.some((assignment) => assignment.role === PrismaUserRole.super_admin)) {
            const otherSuperAdmins = await tx.userRoleAssignment.count({
              where: { role: PrismaUserRole.super_admin, userId: { not: id }, user: { deactivatedAt: null } },
            });
            if (otherSuperAdmins === 0) {
              throw new ConflictError('The last Super Admin cannot be deactivated', { operation: 'deactivate', service: 'user' });
            }
          }

          const now = new Date();
          await tx.userRoleAssignment.deleteMany({ where: { userId: id } });
          await tx.apiKey.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: now } });
          await tx.user.update({ where: { id }, data: { deactivatedAt: now } });
        },
        { isolationLevel: 'Serializable' }
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictError('Another change to this user was in progress. Try again.', { operation: 'deactivate', service: 'user' });
      }
      throw error;
    }

    serverLogger.info({ userId: id, deactivatedBy: callerId }, 'User deactivated');
    return this.findById(id);
  }

  public async reactivate(id: string, callerId: string): Promise<PrismaUser> {
    const prisma = getPrismaClient();
    const user = await this.findById(id);
    if (!user.deactivatedAt) return user;

    await prisma.user.update({ where: { id }, data: { deactivatedAt: null } });
    serverLogger.info({ userId: id, reactivatedBy: callerId }, 'User reactivated');
    return this.findById(id);
  }

  private async findActiveById(id: string, operation: string): Promise<PrismaUser> {
    const user = await this.findById(id);
    if (user.deactivatedAt) {
      throw new ConflictError('Reactivate this user before assigning roles', { operation, service: 'user' });
    }
    return user;
  }

  private async reindexAuthoredBlogs(userId: string): Promise<void> {
    const prisma = getPrismaClient();
    const blogs = await prisma.blog.findMany({
      where: { createdBy: userId, status: 'published' },
      include: {
        author: { select: { name: true, avatarUrl: true } },
        products: { include: { product: { select: { id: true, name: true } } } },
      },
    });
    await Promise.all(blogs.map((blog) => this.searchService.indexBlogDocument(toBlogDocument(blog))));
  }
}
