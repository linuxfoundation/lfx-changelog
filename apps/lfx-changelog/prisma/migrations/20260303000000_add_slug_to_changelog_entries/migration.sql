-- Copyright The Linux Foundation and each contributor to LFX.
-- SPDX-License-Identifier: MIT

-- AlterTable
ALTER TABLE "changelog_entries" ADD COLUMN "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "changelog_entries_slug_key" ON "changelog_entries"("slug");
