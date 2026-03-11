-- Copyright The Linux Foundation and each contributor to LFX.
-- SPDX-License-Identifier: MIT

-- DropForeignKey
ALTER TABLE "agent_jobs" DROP CONSTRAINT "agent_jobs_product_id_fkey";

-- AlterTable
ALTER TABLE "agent_jobs" ALTER COLUMN "product_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "agent_jobs" ADD CONSTRAINT "agent_jobs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "blogs_type_period_start_key" ON "blogs"("type", "period_start");
