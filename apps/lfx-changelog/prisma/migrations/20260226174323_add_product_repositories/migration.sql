-- Copyright The Linux Foundation and each contributor to LFX.
-- SPDX-License-Identifier: MIT

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "github_installation_id" INTEGER;

-- CreateTable
CREATE TABLE "product_repositories" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "github_installation_id" INTEGER NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "html_url" TEXT NOT NULL,
    "description" TEXT,
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_repositories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_repositories_product_id_idx" ON "product_repositories"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_repositories_product_id_owner_name_key" ON "product_repositories"("product_id", "owner", "name");

-- AddForeignKey
ALTER TABLE "product_repositories" ADD CONSTRAINT "product_repositories_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
