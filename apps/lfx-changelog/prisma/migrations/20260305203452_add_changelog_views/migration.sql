-- Copyright The Linux Foundation and each contributor to LFX.
-- SPDX-License-Identifier: MIT

-- CreateTable
CREATE TABLE "changelog_views" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "last_viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "changelog_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "changelog_views_user_id_idx" ON "changelog_views"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "changelog_views_user_id_product_id_key" ON "changelog_views"("user_id", "product_id");

-- AddForeignKey
ALTER TABLE "changelog_views" ADD CONSTRAINT "changelog_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "changelog_views" ADD CONSTRAINT "changelog_views_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
