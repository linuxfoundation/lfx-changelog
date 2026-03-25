// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

export type ChangelogEntry = {
  id: string;
  slug: string | null;
  title: string;
  description: string;
  version: string | null;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  product?: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
  };
  author?: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
};

export type ChangelogApiResponse = {
  success: boolean;
  data: ChangelogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type LfxChangelogAttributes = {
  product: string;
  theme: 'light' | 'dark';
  limit: number;
  'base-url': string;
};
