-- Copyright The Linux Foundation and each contributor to LFX.
-- SPDX-License-Identifier: MIT

-- CreateEnum
CREATE TYPE "BlogPostStatus" AS ENUM ('draft', 'published');

-- CreateEnum
CREATE TYPE "BlogPostType" AS ENUM ('monthly_roundup', 'product_newsletter');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AgentJobTrigger" ADD VALUE 'newsletter_monthly';
ALTER TYPE "AgentJobTrigger" ADD VALUE 'newsletter_product';
ALTER TYPE "AgentJobTrigger" ADD VALUE 'newsletter_manual';

-- AlterTable
ALTER TABLE "agent_jobs" ADD COLUMN     "blog_post_id" TEXT;

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "description" TEXT NOT NULL,
    "type" "BlogPostType" NOT NULL DEFAULT 'monthly_roundup',
    "status" "BlogPostStatus" NOT NULL DEFAULT 'draft',
    "cover_image_url" TEXT,
    "published_at" TIMESTAMP(3),
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_post_products" (
    "id" TEXT NOT NULL,
    "blog_post_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,

    CONSTRAINT "blog_post_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_post_changelog_entries" (
    "id" TEXT NOT NULL,
    "blog_post_id" TEXT NOT NULL,
    "changelog_entry_id" TEXT NOT NULL,

    CONSTRAINT "blog_post_changelog_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "blog_posts_status_published_at_idx" ON "blog_posts"("status", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "blog_post_products_blog_post_id_product_id_key" ON "blog_post_products"("blog_post_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "blog_post_changelog_entries_blog_post_id_changelog_entry_id_key" ON "blog_post_changelog_entries"("blog_post_id", "changelog_entry_id");

-- AddForeignKey
ALTER TABLE "agent_jobs" ADD CONSTRAINT "agent_jobs_blog_post_id_fkey" FOREIGN KEY ("blog_post_id") REFERENCES "blog_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_post_products" ADD CONSTRAINT "blog_post_products_blog_post_id_fkey" FOREIGN KEY ("blog_post_id") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_post_products" ADD CONSTRAINT "blog_post_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_post_changelog_entries" ADD CONSTRAINT "blog_post_changelog_entries_blog_post_id_fkey" FOREIGN KEY ("blog_post_id") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_post_changelog_entries" ADD CONSTRAINT "blog_post_changelog_entries_changelog_entry_id_fkey" FOREIGN KEY ("changelog_entry_id") REFERENCES "changelog_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
