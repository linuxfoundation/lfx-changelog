-- Copyright The Linux Foundation and each contributor to LFX.
-- SPDX-License-Identifier: MIT

-- Step 1: Add slug column as nullable
ALTER TABLE "changelog_entries" ADD COLUMN "slug" TEXT;

-- Step 2: Backfill existing rows — generate slug from title
-- Lowercase, replace non-alphanumeric with hyphens, collapse multiple hyphens, trim hyphens
UPDATE "changelog_entries"
SET "slug" = CONCAT(
  TRIM(BOTH '-' FROM
    regexp_replace(
      regexp_replace(
        lower(title),
        '[^a-z0-9]+', '-', 'g'
      ),
      '-{2,}', '-', 'g'
    )
  ),
  '-', LEFT(id::text, 8)
)
WHERE "slug" IS NULL;

-- Step 3: Make slug NOT NULL
ALTER TABLE "changelog_entries" ALTER COLUMN "slug" SET NOT NULL;

-- Step 4: Add unique constraint
CREATE UNIQUE INDEX "changelog_entries_slug_key" ON "changelog_entries"("slug");
