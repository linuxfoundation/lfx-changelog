// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import './setup.js';

export {
  AiChangelogMetadataSchema,
  AiProductSummarySchema,
  AiSummaryResponseSchema,
  ChangelogGenerationStateSchema,
  ChangelogSSEEventSchema,
  GenerateChangelogRequestSchema,
  OpenAIChatChoiceSchema,
  OpenAIChatMessageSchema,
  OpenAIChatRequestSchema,
  OpenAIChatResponseSchema,
  OpenAIJsonSchemaFormatSchema,
  OpenAIStreamChunkSchema,
  OpenAIStreamDeltaChoiceSchema,
} from './ai.schema.js';
export { ApiKeySchema, CreateApiKeyRequestSchema, CreateApiKeyResponseSchema } from './api-key.schema.js';
export { createApiResponseSchema, createPaginatedResponseSchema } from './api-response.schema.js';
export { AuthContextSchema, AuthUserSchema } from './auth.schema.js';
export { ChangelogEntrySchema, ChangelogEntryWithRelationsSchema } from './changelog-entry.schema.js';
export {
  AssignRoleRequestSchema,
  CreateChangelogEntryRequestSchema,
  CreateProductRequestSchema,
  CreateUserRequestSchema,
  UpdateChangelogEntryRequestSchema,
  UpdateProductRequestSchema,
} from './dto.schema.js';
export {
  GitHubCommitSchema,
  GitHubInstallationSchema,
  GitHubPullRequestSchema,
  GitHubReleaseSchema,
  GitHubRepositorySchema,
  LinkRepositoryRequestSchema,
  ProductActivitySchema,
  ProductRepositorySchema,
} from './github.schema.js';
export { ProductSchema } from './product.schema.js';
export { PublicAuthorSchema, PublicChangelogEntrySchema, PublicProductSchema } from './public.schema.js';
export { UserRoleAssignmentSchema, UserSchema } from './user.schema.js';

export type {
  AiChangelogMetadata,
  AiProductSummary,
  AiSummaryResponse,
  ChangelogGenerationState,
  ChangelogSSEEvent,
  ChangelogSSEEventType,
  GenerateChangelogRequest,
  OpenAIChatChoice,
  OpenAIChatMessage,
  OpenAIChatRequest,
  OpenAIChatResponse,
  OpenAIChatRole,
  OpenAIJsonSchemaFormat,
  OpenAIStreamChunk,
  OpenAIStreamDeltaChoice,
} from './ai.schema.js';
export type { ApiKey, ApiKeyScopeMetadata, CreateApiKeyRequest, CreateApiKeyResponse } from './api-key.schema.js';
export type { ApiResponse, PaginatedResponse } from './api-response.schema.js';
export type { AuthContext, AuthUser } from './auth.schema.js';
export type { ChangelogEntry, ChangelogEntryWithRelations } from './changelog-entry.schema.js';
export type {
  AssignRoleRequest,
  CreateChangelogEntryRequest,
  CreateProductRequest,
  CreateUserRequest,
  UpdateChangelogEntryRequest,
  UpdateProductRequest,
} from './dto.schema.js';
export type {
  GitHubCommit,
  GitHubInstallation,
  GitHubPullRequest,
  GitHubRelease,
  GitHubRepository,
  LinkRepositoryRequest,
  ProductActivity,
  ProductRepository,
} from './github.schema.js';
export type { Product } from './product.schema.js';
export type { PublicAuthor, PublicChangelogEntry, PublicProduct } from './public.schema.js';
export type { User, UserRoleAssignment } from './user.schema.js';
