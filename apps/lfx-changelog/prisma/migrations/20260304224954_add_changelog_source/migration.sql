-- Copyright The Linux Foundation and each contributor to LFX.
-- SPDX-License-Identifier: MIT

-- CreateEnum
CREATE TYPE "ChangelogSource" AS ENUM ('manual', 'automated');

-- AlterTable
ALTER TABLE "changelog_entries" ADD COLUMN     "source" "ChangelogSource" NOT NULL DEFAULT 'manual';
