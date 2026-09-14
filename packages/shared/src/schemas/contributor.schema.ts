// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { z } from 'zod';

import { ContributorSlackLinkSource } from '../enums/contributor-slack-link-source.enum.js';

export const ContributorRepositoryLinkSchema = z
  .object({
    id: z.string().uuid(),
    repositoryId: z.string().uuid(),
    contributions: z.number(),
    lastActiveAt: z.string().nullable(),
    repositoryFullName: z.string(),
    repositoryHtmlUrl: z.string(),
    productId: z.string().uuid(),
    productName: z.string(),
    productSlug: z.string(),
    productFaIcon: z.string().nullable(),
  })
  .openapi('ContributorRepositoryLink');

export type ContributorRepositoryLink = z.infer<typeof ContributorRepositoryLinkSchema>;

export const ContributorSchema = z
  .object({
    id: z.string().uuid(),
    githubUserId: z.number(),
    githubLogin: z.string(),
    githubAvatarUrl: z.string().nullable(),
    githubHtmlUrl: z.string().nullable(),
    name: z.string().nullable(),
    primaryEmail: z.string().nullable(),
    emails: z.array(z.string()),
    isBot: z.boolean(),
    slackUserId: z.string().nullable(),
    slackTeamId: z.string().nullable(),
    slackDisplayName: z.string().nullable(),
    slackRealName: z.string().nullable(),
    slackAvatarUrl: z.string().nullable(),
    slackLinkSource: z.nativeEnum(ContributorSlackLinkSource).nullable(),
    slackLinkedAt: z.string().nullable(),
    slackLinkedById: z.string().nullable(),
    userId: z.string().nullable(),
    contributions: z.number(),
    firstSeenAt: z.string(),
    lastActiveAt: z.string().nullable(),
    lastSyncedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('Contributor');

export type Contributor = z.infer<typeof ContributorSchema>;

export const ContributorWithRelationsSchema = ContributorSchema.extend({
  repositories: z.array(ContributorRepositoryLinkSchema).optional(),
}).openapi('ContributorWithRelations');

export type ContributorWithRelations = z.infer<typeof ContributorWithRelationsSchema>;

export const ContributorQueryParamsSchema = z
  .object({
    query: z.string().optional().openapi({ description: 'Free-text search across GitHub login, display name, and known emails' }),
    productId: z.string().uuid().optional().openapi({ description: 'Only contributors who contributed to this product' }),
    repositoryId: z.string().uuid().optional().openapi({ description: 'Only contributors who contributed to this repository' }),
    slackLink: z.enum(['linked', 'unlinked']).optional().openapi({ description: 'Filter by whether a Slack account is associated' }),
    // Not z.coerce.boolean() — that maps every non-empty string to true, so `includeBots=false` would include bots.
    includeBots: z
      .union([z.boolean(), z.enum(['true', 'false']).transform((value) => value === 'true')])
      .optional()
      .openapi({ description: 'Include bot accounts (excluded by default)' }),
    page: z.coerce.number().int().min(1).optional().openapi({ description: 'Page number' }),
    limit: z.coerce.number().int().min(1).max(100).optional().openapi({ description: 'Results per page (max: 100)' }),
  })
  .openapi('ContributorQueryParams');

export type ContributorQueryParams = z.infer<typeof ContributorQueryParamsSchema>;

export const ContributorSyncResultSchema = z
  .object({
    repositoriesScanned: z.number(),
    contributorsCreated: z.number(),
    contributorsUpdated: z.number(),
    slackAutoLinked: z.number(),
    errors: z.array(z.string()),
  })
  .openapi('ContributorSyncResult');

export type ContributorSyncResult = z.infer<typeof ContributorSyncResultSchema>;
