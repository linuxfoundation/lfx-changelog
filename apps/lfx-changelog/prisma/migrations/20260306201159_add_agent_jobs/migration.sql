-- Copyright The Linux Foundation and each contributor to LFX.
-- SPDX-License-Identifier: MIT

-- CreateEnum
CREATE TYPE "AgentJobStatus" AS ENUM ('pending', 'running', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "AgentJobTrigger" AS ENUM ('webhook_push', 'webhook_release', 'webhook_pull_request', 'manual');

-- CreateTable
CREATE TABLE "agent_jobs" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "trigger" "AgentJobTrigger" NOT NULL,
    "status" "AgentJobStatus" NOT NULL DEFAULT 'pending',
    "changelog_entry_id" TEXT,
    "prompt_tokens" INTEGER,
    "output_tokens" INTEGER,
    "duration_ms" INTEGER,
    "num_turns" INTEGER,
    "progress_log" JSONB NOT NULL DEFAULT '[]',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_jobs_product_id_status_idx" ON "agent_jobs"("product_id", "status");

-- CreateIndex
CREATE INDEX "agent_jobs_created_at_idx" ON "agent_jobs"("created_at");

-- AddForeignKey
ALTER TABLE "agent_jobs" ADD CONSTRAINT "agent_jobs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_jobs" ADD CONSTRAINT "agent_jobs_changelog_entry_id_fkey" FOREIGN KEY ("changelog_entry_id") REFERENCES "changelog_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
