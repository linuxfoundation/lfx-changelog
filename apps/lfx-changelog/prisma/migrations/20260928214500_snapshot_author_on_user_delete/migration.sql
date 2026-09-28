-- Copyright The Linux Foundation and each contributor to LFX.
-- SPDX-License-Identifier: MIT

-- DropForeignKey
ALTER TABLE "changelog_entries" DROP CONSTRAINT "changelog_entries_created_by_fkey";

-- DropForeignKey
ALTER TABLE "blogs" DROP CONSTRAINT "blogs_created_by_fkey";

-- DropForeignKey
ALTER TABLE "user_role_assignments" DROP CONSTRAINT "user_role_assignments_user_id_fkey";

-- AlterTable
ALTER TABLE "changelog_entries" ALTER COLUMN "created_by" DROP NOT NULL,
ADD COLUMN     "author_name" TEXT,
ADD COLUMN     "author_avatar_url" TEXT;

-- AlterTable
ALTER TABLE "blogs" ALTER COLUMN "created_by" DROP NOT NULL,
ADD COLUMN     "author_name" TEXT,
ADD COLUMN     "author_avatar_url" TEXT;

-- AddForeignKey
ALTER TABLE "changelog_entries" ADD CONSTRAINT "changelog_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blogs" ADD CONSTRAINT "blogs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
