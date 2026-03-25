// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

// Compile-time compatibility check — ensures widget types stay in sync with the
// shared package. If @lfx-changelog/shared changes a field, this file will fail
// to compile, surfacing the drift immediately.
//
// This file is NOT included in the bundle (Vite only bundles from index.ts).

import type { PaginatedResponse, PublicChangelogEntry } from '@lfx-changelog/shared';

import type { ChangelogApiResponse, ChangelogEntry } from './types.js';

type AssertAssignable<_Target, _Source extends _Target> = never;

// Widget ChangelogEntry must accept everything the shared PublicChangelogEntry provides
type _CheckEntry = AssertAssignable<ChangelogEntry, PublicChangelogEntry>;

// Widget ChangelogApiResponse must accept everything the shared PaginatedResponse provides
type _CheckResponse = AssertAssignable<ChangelogApiResponse, PaginatedResponse<PublicChangelogEntry>>;
