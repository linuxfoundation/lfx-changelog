// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { getPrismaClient } from './prisma.service';

import type { SlackMapEntry } from '../interfaces/release.interface';

export class ReleaseSlackMapService {
  public async load(): Promise<Map<string, SlackMapEntry>> {
    const prisma = getPrismaClient();
    const rows = await prisma.contributorSlackMap.findMany();
    return new Map(rows.map((row) => [row.githubUsername, row]));
  }
}

export const releaseSlackMapService = new ReleaseSlackMapService();
