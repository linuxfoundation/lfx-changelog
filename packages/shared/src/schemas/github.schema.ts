// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { z } from 'zod';

export const GitHubInstallationSchema = z
  .object({
    id: z.number(),
    account: z.object({
      login: z.string(),
      avatar_url: z.string(),
    }),
    repository_selection: z.enum(['all', 'selected']),
    app_slug: z.string(),
  })
  .openapi('GitHubInstallation');

export type GitHubInstallation = z.infer<typeof GitHubInstallationSchema>;

export const GitHubRepositorySchema = z
  .object({
    id: z.number(),
    name: z.string(),
    full_name: z.string(),
    owner: z.object({
      login: z.string(),
    }),
    html_url: z.string(),
    description: z.string().nullable(),
    private: z.boolean(),
    language: z.string().nullable(),
  })
  .openapi('GitHubRepository');

export type GitHubRepository = z.infer<typeof GitHubRepositorySchema>;

export const ProductRepositorySchema = z
  .object({
    id: z.string(),
    productId: z.string(),
    githubInstallationId: z.number(),
    owner: z.string(),
    name: z.string(),
    fullName: z.string(),
    htmlUrl: z.string(),
    description: z.string().nullable(),
    isPrivate: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('ProductRepository');

export type ProductRepository = z.infer<typeof ProductRepositorySchema>;

export const GitHubPullRequestSchema = z
  .object({
    id: z.number(),
    number: z.number(),
    title: z.string(),
    state: z.string(),
    html_url: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
    user: z.object({ login: z.string(), avatar_url: z.string() }),
    draft: z.boolean(),
    labels: z.array(z.object({ name: z.string(), color: z.string() })),
    repoFullName: z.string(),
  })
  .openapi('GitHubPullRequest');

export type GitHubPullRequest = z.infer<typeof GitHubPullRequestSchema>;

export const GitHubCommitSchema = z
  .object({
    sha: z.string(),
    html_url: z.string(),
    commit: z.object({
      message: z.string(),
      author: z.object({ name: z.string(), date: z.string() }),
    }),
    author: z.object({ login: z.string(), avatar_url: z.string() }).nullable(),
    repoFullName: z.string(),
  })
  .openapi('GitHubCommit');

export type GitHubCommit = z.infer<typeof GitHubCommitSchema>;

export const GitHubReleaseSchema = z
  .object({
    id: z.number(),
    tag_name: z.string(),
    name: z.string().nullable(),
    html_url: z.string(),
    body: z.string().nullable(),
    draft: z.boolean(),
    prerelease: z.boolean(),
    published_at: z.string().nullable(),
    author: z.object({ login: z.string(), avatar_url: z.string() }),
    repoFullName: z.string(),
  })
  .openapi('GitHubRelease');

export type GitHubRelease = z.infer<typeof GitHubReleaseSchema>;

export const ProductActivitySchema = z
  .object({
    releases: z.array(GitHubReleaseSchema),
    pullRequests: z.array(GitHubPullRequestSchema),
    commits: z.array(GitHubCommitSchema),
  })
  .openapi('ProductActivity');

export type ProductActivity = z.infer<typeof ProductActivitySchema>;

export const LinkRepositoryRequestSchema = z
  .object({
    githubInstallationId: z.number(),
    owner: z.string(),
    name: z.string(),
    fullName: z.string(),
    htmlUrl: z.string(),
    description: z.string().optional(),
    isPrivate: z.boolean(),
  })
  .openapi('LinkRepositoryRequest');

export type LinkRepositoryRequest = z.infer<typeof LinkRepositoryRequestSchema>;
