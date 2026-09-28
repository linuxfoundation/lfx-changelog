// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import type { PublicAuthor } from '@lfx-changelog/shared';

type LiveAuthor = { id: string; name: string; avatarUrl: string | null } | null | undefined;

type AuthorSnapshot = { authorName?: string | null; authorAvatarUrl?: string | null };

/**
 * Map a live User relation or a delete-time name/avatar snapshot onto the PublicAuthor contract.
 * Live authors keep their directory id and `former: false`. Deleted authors use the snapshot with
 * `id: null` and `former: true`. Returns undefined when neither a relation nor a snapshot name exists.
 */
export function mapPublicAuthor(author: LiveAuthor, snapshot?: AuthorSnapshot): PublicAuthor | undefined {
  if (author) {
    return { id: author.id, name: author.name, avatarUrl: author.avatarUrl, former: false };
  }

  if (!snapshot?.authorName) {
    return undefined;
  }

  return {
    id: null,
    name: snapshot.authorName,
    avatarUrl: snapshot.authorAvatarUrl ?? null,
    former: true,
  };
}
