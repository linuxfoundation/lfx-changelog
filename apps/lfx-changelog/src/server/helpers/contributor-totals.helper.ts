// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { Prisma, PrismaClient } from '@prisma/client';

type PrismaLike = PrismaClient | Prisma.TransactionClient;

/**
 * Recomputes the denormalized `Contributor.contributions` for the given contributors.
 *
 * Lives outside the services because both ContributorService and ProductService need it, and
 * importing one into the other would close a product -> contributor -> github -> product cycle.
 *
 * Also recomputes lastActiveAt, which is likewise a cross-repository aggregate.
 *
 * Totals are deduplicated by repository full name: `ProductRepository` is unique only on
 * (productId, owner, name), so one GitHub repository linked to two products produces two rows
 * carrying the same GitHub contribution count. Summing the links directly would double-count it.
 */
export async function recalculateContributorTotals(prisma: PrismaLike, contributorIds: string[]): Promise<void> {
  if (contributorIds.length === 0) return;

  const contributors = await prisma.contributor.findMany({
    where: { id: { in: contributorIds } },
    select: {
      id: true,
      repositories: { select: { contributions: true, lastActiveAt: true, repository: { select: { fullName: true } } } },
    },
  });

  for (const contributor of contributors) {
    const byRepository = new Map<string, number>();
    for (const link of contributor.repositories) {
      const current = byRepository.get(link.repository.fullName) ?? 0;
      byRepository.set(link.repository.fullName, Math.max(current, link.contributions));
    }

    const total = [...byRepository.values()].reduce((sum, contributions) => sum + contributions, 0);

    // lastActiveAt is a cross-repository maximum too. Sync only ever grows it, so if the
    // removed link held the newest date it would otherwise persist forever.
    const lastActiveAt = contributor.repositories.reduce<Date | null>(
      (latest, link) => (link.lastActiveAt && (!latest || link.lastActiveAt > latest) ? link.lastActiveAt : latest),
      null
    );

    // Only write a date we actually derived — links with no dates must not erase a known one,
    // matching the per-repository guard in ContributorService.
    await prisma.contributor.update({
      where: { id: contributor.id },
      data: { contributions: total, ...(lastActiveAt ? { lastActiveAt } : {}) },
    });
  }
}

/** Contributor IDs linked to the given repositories, for recomputation after a cascading delete. */
export async function findContributorsForRepositories(prisma: PrismaLike, repositoryIds: string[]): Promise<string[]> {
  if (repositoryIds.length === 0) return [];

  const links = await prisma.contributorRepository.findMany({
    where: { repositoryId: { in: repositoryIds } },
    select: { contributorId: true },
  });

  return [...new Set(links.map((link) => link.contributorId))];
}
