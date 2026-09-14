// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

/** Options for listing public releases. */
export interface FindAllPublicOptions {
  limit?: number;
  productId?: string;
}

export interface GenerateReleaseNotesInput {
  tagName: string;
  targetCommitish: string;
  previousTagName?: string;
}

export interface CreateReleaseInput {
  tagName: string;
  targetCommitish: string;
  name: string;
  body: string;
  prerelease?: boolean;
}
