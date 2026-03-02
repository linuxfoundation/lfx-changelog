-- Copyright The Linux Foundation and each contributor to LFX.
-- SPDX-License-Identifier: MIT

-- CreateTable
CREATE TABLE "github_releases" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "github_id" INTEGER NOT NULL,
    "tag_name" TEXT NOT NULL,
    "name" TEXT,
    "html_url" TEXT NOT NULL,
    "body" TEXT,
    "is_draft" BOOLEAN NOT NULL DEFAULT false,
    "is_prerelease" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "author_login" TEXT NOT NULL,
    "author_avatar_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "github_releases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "github_releases_published_at_idx" ON "github_releases"("published_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "github_releases_repository_id_github_id_key" ON "github_releases"("repository_id", "github_id");

-- AddForeignKey
ALTER TABLE "github_releases" ADD CONSTRAINT "github_releases_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "product_repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
