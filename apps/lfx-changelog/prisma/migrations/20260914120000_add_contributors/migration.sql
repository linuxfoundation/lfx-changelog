-- Copyright The Linux Foundation and each contributor to LFX.
-- SPDX-License-Identifier: MIT

-- CreateEnum
CREATE TYPE "ContributorSlackLinkSource" AS ENUM ('auto_email', 'manual');

-- CreateTable
CREATE TABLE "contributors" (
    "id" TEXT NOT NULL,
    "github_user_id" INTEGER NOT NULL,
    "github_login" TEXT NOT NULL,
    "github_avatar_url" TEXT,
    "github_html_url" TEXT,
    "name" TEXT,
    "primary_email" TEXT,
    "emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_bot" BOOLEAN NOT NULL DEFAULT false,
    "slack_user_id" TEXT,
    "slack_team_id" TEXT,
    "slack_display_name" TEXT,
    "slack_real_name" TEXT,
    "slack_avatar_url" TEXT,
    "slack_link_source" "ContributorSlackLinkSource",
    "slack_linked_at" TIMESTAMP(3),
    "slack_linked_by_id" TEXT,
    "contributions" INTEGER NOT NULL DEFAULT 0,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contributors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contributor_repositories" (
    "id" TEXT NOT NULL,
    "contributor_id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "contributions" INTEGER NOT NULL DEFAULT 0,
    "last_active_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contributor_repositories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contributors_github_user_id_key" ON "contributors"("github_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "contributors_slack_user_id_key" ON "contributors"("slack_user_id");

-- CreateIndex
CREATE INDEX "contributors_github_login_idx" ON "contributors"("github_login");

-- CreateIndex
CREATE INDEX "contributors_last_active_at_idx" ON "contributors"("last_active_at" DESC);

-- CreateIndex
CREATE INDEX "contributors_contributions_idx" ON "contributors"("contributions" DESC);

-- CreateIndex
CREATE INDEX "contributor_repositories_repository_id_idx" ON "contributor_repositories"("repository_id");

-- CreateIndex
CREATE UNIQUE INDEX "contributor_repositories_contributor_id_repository_id_key" ON "contributor_repositories"("contributor_id", "repository_id");

-- AddForeignKey
ALTER TABLE "contributors" ADD CONSTRAINT "contributors_slack_linked_by_id_fkey" FOREIGN KEY ("slack_linked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributor_repositories" ADD CONSTRAINT "contributor_repositories_contributor_id_fkey" FOREIGN KEY ("contributor_id") REFERENCES "contributors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributor_repositories" ADD CONSTRAINT "contributor_repositories_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "product_repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- emails is a non-nullable String[] in the Prisma model, but the generated DDL leaves the
-- column nullable, so a direct insert could produce a row the client types as an array.
-- Same correction applied to api_keys.scopes in 20260301041627.
ALTER TABLE "contributors" ALTER COLUMN "emails" SET NOT NULL;
ALTER TABLE "contributors" ALTER COLUMN "emails" SET DEFAULT '{}';
