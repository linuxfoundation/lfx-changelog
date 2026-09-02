// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { getPrismaClient } from './prisma.service';

export interface SlackMapEntry {
  githubUsername: string;
  slackId: string;
  displayName: string;
}

export class ReleaseSlackMapService {
  public async load(): Promise<Map<string, SlackMapEntry>> {
    const prisma = getPrismaClient();
    const rows = await prisma.contributorSlackMap.findMany();
    return new Map(rows.map((row) => [row.githubUsername, row]));
  }

  public substitute(message: string, mapping: Map<string, SlackMapEntry>): string {
    let next = message;
    const usernames = [...mapping.keys()].sort((a, b) => b.length - a.length);
    for (const username of usernames) {
      const entry = mapping.get(username);
      if (!entry) continue;
      next = next.replaceAll(`@${username}`, `<@${entry.slackId}>`);
    }
    return next;
  }
}

export const releaseSlackMapService = new ReleaseSlackMapService();
