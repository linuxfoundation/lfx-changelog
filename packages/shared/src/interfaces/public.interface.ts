// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

/** Trimmed product for public (unauthenticated) API responses. */
export interface PublicProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  faIcon: string | null;
}

/** Trimmed author for public changelog responses. */
export interface PublicAuthor {
  id: string;
  name: string;
  avatarUrl: string | null;
}

/** Changelog entry shape returned by public endpoints — no FK columns, trimmed relations. */
export interface PublicChangelogEntry {
  id: string;
  title: string;
  description: string;
  version: string | null;
  status: string;
  publishedAt: Date | string | null;
  createdAt: Date | string;
  product?: PublicProduct;
  author?: PublicAuthor;
}
