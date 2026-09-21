-- Copyright The Linux Foundation and each contributor to LFX.
-- SPDX-License-Identifier: MIT

-- CreateEnum
CREATE TYPE "ReleaseJobStatus" AS ENUM ('pending', 'running', 'succeeded', 'failed');

-- CreateTable
CREATE TABLE "release_jobs" (
    "id" TEXT NOT NULL,
    "releasable_service_id" TEXT NOT NULL,
    "tag_name" TEXT NOT NULL,
    "status" "ReleaseJobStatus" NOT NULL DEFAULT 'pending',
    "requested_by_id" TEXT,
    "workflow_run_id" TEXT,
    "workflow_run_url" TEXT,
    "workflow_name" TEXT,
    "conclusion" TEXT,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "release_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "release_jobs_releasable_service_id_created_at_idx" ON "release_jobs"("releasable_service_id", "created_at");

-- CreateIndex
CREATE INDEX "release_jobs_workflow_run_id_idx" ON "release_jobs"("workflow_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "release_jobs_releasable_service_id_tag_name_key" ON "release_jobs"("releasable_service_id", "tag_name");

-- AddForeignKey
ALTER TABLE "release_jobs" ADD CONSTRAINT "release_jobs_releasable_service_id_fkey" FOREIGN KEY ("releasable_service_id") REFERENCES "releasable_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_jobs" ADD CONSTRAINT "release_jobs_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

