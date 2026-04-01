// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Prisma, UserRoleAssignment as PrismaRoleAssignment, User as PrismaUser, UserRole as PrismaUserRole } from '@prisma/client';

import { ConflictError, NotFoundError } from '../errors';

import { getPrismaClient } from './prisma.service';

const USER_INCLUDE = { userRoleAssignments: { include: { product: true } } } as const;

export class UserService {
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
            productId: pid ?? null,
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
}
