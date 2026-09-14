// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

/** Git author details harvested from a repository's recent commits, keyed by GitHub login. */
export interface CommitProfile {
  emails: Set<string>;
  name: string | null;
  lastActiveAt: Date | null;
}

/** Commit harvest for one repository, plus any reasons the harvest was partial. */
export interface CommitProfileHarvest {
  profilesByLogin: Map<string, CommitProfile>;
  warnings: string[];
}

/**
 * Per-repository sync tallies. Created and updated carry GitHub user IDs rather than
 * counts so the caller can de-duplicate a contributor seen across several repositories.
 */
export interface RepositorySyncCounts {
  created: number[];
  updated: number[];
  slackLinked: number;
  warnings: string[];
}

/** Shape of a ContributorRepository row loaded with its repository and product. */
export interface ContributorRepositoryRow {
  id: string;
  repositoryId: string;
  contributions: number;
  lastActiveAt: Date | null;
  repository: {
    fullName: string;
    htmlUrl: string;
    product: { id: string; name: string; slug: string; faIcon: string | null };
  };
}
