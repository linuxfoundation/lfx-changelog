-- Copyright The Linux Foundation and each contributor to LFX.
-- SPDX-License-Identifier: MIT

-- CreateEnum
CREATE TYPE "AutoChangelogLockStatus" AS ENUM ('in_progress', 'pending_rerun');

-- CreateTable
CREATE TABLE "auto_changelog_locks" (
    "product_id" TEXT NOT NULL,
    "status" "AutoChangelogLockStatus" NOT NULL DEFAULT 'in_progress',
    "locked_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auto_changelog_locks_pkey" PRIMARY KEY ("product_id")
);

-- AddForeignKey
ALTER TABLE "auto_changelog_locks" ADD CONSTRAINT "auto_changelog_locks_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
