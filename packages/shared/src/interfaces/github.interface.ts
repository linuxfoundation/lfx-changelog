// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

export interface GitHubInstallation {
  id: number;
  account: {
    login: string;
    avatar_url: string;
  };
  repository_selection: 'all' | 'selected';
  app_slug: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
  };
  html_url: string;
  description: string | null;
  private: boolean;
  language: string | null;
}

export interface ProductRepository {
  id: string;
  productId: string;
  githubInstallationId: number;
  owner: string;
  name: string;
  fullName: string;
  htmlUrl: string;
  description: string | null;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  state: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  user: { login: string; avatar_url: string };
  draft: boolean;
  labels: Array<{ name: string; color: string }>;
  repoFullName: string;
}

export interface GitHubCommit {
  sha: string;
  html_url: string;
  commit: { message: string; author: { name: string; date: string } };
  author: { login: string; avatar_url: string } | null;
  repoFullName: string;
}

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  html_url: string;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  author: { login: string; avatar_url: string };
  repoFullName: string;
}

export interface ProductActivity {
  releases: GitHubRelease[];
  pullRequests: GitHubPullRequest[];
  commits: GitHubCommit[];
}

export interface LinkRepositoryRequest {
  githubInstallationId: number;
  owner: string;
  name: string;
  fullName: string;
  htmlUrl: string;
  description?: string;
  isPrivate: boolean;
}
