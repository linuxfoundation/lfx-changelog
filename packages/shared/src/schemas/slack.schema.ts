// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { z } from 'zod';

export const SlackIntegrationSchema = z
  .object({
    id: z.string().uuid(),
    teamId: z.string(),
    teamName: z.string(),
    slackUserId: z.string(),
    scope: z.string(),
    status: z.string(),
    tokenExpiresAt: z.string(),
    connectedAt: z.string(),
    channels: z.array(z.lazy(() => SlackChannelSchema)).optional(),
  })
  .openapi('SlackIntegration');

export type SlackIntegration = z.infer<typeof SlackIntegrationSchema>;

export const SlackChannelSchema = z
  .object({
    id: z.string().uuid(),
    channelId: z.string(),
    channelName: z.string(),
    isDefault: z.boolean(),
    createdAt: z.string(),
  })
  .openapi('SlackChannel');

export type SlackChannel = z.infer<typeof SlackChannelSchema>;

export const SlackChannelOptionSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    isPrivate: z.boolean(),
  })
  .openapi('SlackChannelOption');

export type SlackChannelOption = z.infer<typeof SlackChannelOptionSchema>;

export const PostToSlackRequestSchema = z
  .object({
    channelId: z.string().min(1),
    channelName: z.string().min(1),
  })
  .openapi('PostToSlackRequest');

export type PostToSlackRequest = z.infer<typeof PostToSlackRequestSchema>;

export const PostToSlackResponseSchema = z
  .object({
    messageTs: z.string(),
    channelName: z.string(),
  })
  .openapi('PostToSlackResponse');

export type PostToSlackResponse = z.infer<typeof PostToSlackResponseSchema>;

export const SaveSlackChannelRequestSchema = z
  .object({
    channelId: z.string().min(1),
    channelName: z.string().min(1),
  })
  .openapi('SaveSlackChannelRequest');

export type SaveSlackChannelRequest = z.infer<typeof SaveSlackChannelRequestSchema>;

export const PostChangelogEntrySchema = z
  .object({
    id: z.string(),
    slug: z.string().nullable(),
    title: z.string(),
    description: z.string(),
    version: z.string().nullable(),
    product: z.object({ name: z.string(), faIcon: z.string().nullable() }).nullable().optional(),
    author: z.object({ name: z.string() }).nullable().optional(),
  })
  .openapi('PostChangelogEntry');

export type PostChangelogEntry = z.infer<typeof PostChangelogEntrySchema>;

export const SlackBlockSchema = z
  .object({
    type: z.string(),
    text: z.object({ type: z.string(), text: z.string(), emoji: z.boolean().optional() }).optional(),
    fields: z.array(z.object({ type: z.string(), text: z.string() })).optional(),
    elements: z.array(z.record(z.string(), z.json())).optional(),
  })
  .openapi('SlackBlock');

export type SlackBlock = z.infer<typeof SlackBlockSchema>;

export const SlackApiResponseSchema = z
  .object({
    ok: z.boolean(),
    error: z.string().optional(),
  })
  .passthrough();

export type SlackApiResponse = z.infer<typeof SlackApiResponseSchema>;
