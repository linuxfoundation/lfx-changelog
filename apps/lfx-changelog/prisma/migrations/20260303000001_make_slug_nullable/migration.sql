-- Copyright The Linux Foundation and each contributor to LFX.
-- SPDX-License-Identifier: MIT

-- Make slug nullable for backward compatibility with existing entries
ALTER TABLE "changelog_entries" ALTER COLUMN "slug" DROP NOT NULL;

-- Clear backfilled slugs so existing entries have NULL slugs
UPDATE "changelog_entries" SET "slug" = NULL;
