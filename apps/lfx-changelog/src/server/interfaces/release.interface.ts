// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

/** Options for listing public releases. */
export interface FindAllPublicOptions {
  limit?: number;
  productId?: string;
  repositoryId?: string;
}

/**
 * Input for GitHub's release-note generation. `previousTagName` bounds the window of merged
 * pull requests; GitHub picks the previous tag itself when it is omitted.
 */
export interface GenerateReleaseNotesInput {
  tagName: string;
  targetCommitish: string;
  previousTagName?: string;
}

/** Summary of a two-dot comparison between the previous tag and a release target. */
export interface GitHubComparison {
  totalCommits: number;
  compareUrl: string | null;
}

/** Input for publishing a release. Structurally the `CreateReleaseRequest` DTO, minus the HTTP layer. */
export interface CreateReleaseInput {
  tagName: string;
  targetCommitish: string;
  name: string;
  body: string;
  prerelease?: boolean;
}
