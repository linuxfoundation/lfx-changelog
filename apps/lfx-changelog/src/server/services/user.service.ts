// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { UserRoleAssignment as PrismaRoleAssignment, User as PrismaUser, UserRole as PrismaUserRole } from '@prisma/client';

import { ConflictError, NotFoundError } from '../errors';

import { getPrismaClient } from './prisma.service';

export class UserService {
  public async findByEmail(email: string): Promise<PrismaUser | null> {
    const prisma = getPrismaClient();
    return prisma.user.findUnique({
      where: { email },
      include: { userRoleAssignments: { include: { product: true } } },
    });
  }

  public async create(data: { email: string; name: string }): Promise<PrismaUser> {
    const prisma = getPrismaClient();
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new ConflictError(`User with email ${data.email} already exists`, { operation: 'create', service: 'user' });
    }
    return prisma.user.create({
      data: { email: data.email, name: data.name },
      include: { userRoleAssignments: { include: { product: true } } },
    });
  }

  public async findById(id: string): Promise<PrismaUser> {
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({
      where: { id },
      include: { userRoleAssignments: { include: { product: true } } },
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
      include: { userRoleAssignments: { include: { product: true } } },
    });
  }

  public async findAll(): Promise<PrismaUser[]> {
    const prisma = getPrismaClient();
    return prisma.user.findMany({
      include: { userRoleAssignments: { include: { product: true } } },
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

  public async removeRole(roleId: string): Promise<void> {
    const prisma = getPrismaClient();
    const assignment = await prisma.userRoleAssignment.findUnique({ where: { id: roleId } });
    if (!assignment) {
      throw new NotFoundError(`Role assignment not found: ${roleId}`, { operation: 'removeRole', service: 'user' });
    }
    await prisma.userRoleAssignment.delete({ where: { id: roleId } });
  }
}
