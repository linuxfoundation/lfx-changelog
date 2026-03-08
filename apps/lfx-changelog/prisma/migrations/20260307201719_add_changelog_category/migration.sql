-- Copyright The Linux Foundation and each contributor to LFX.
-- SPDX-License-Identifier: MIT

-- CreateEnum
CREATE TYPE "ChangelogCategory" AS ENUM ('feature', 'bugfix', 'improvement', 'security', 'deprecation', 'breaking_change', 'other');

-- AlterTable
ALTER TABLE "changelog_entries" ADD COLUMN     "category" "ChangelogCategory";
