-- Copyright The Linux Foundation and each contributor to LFX.
-- SPDX-License-Identifier: MIT

-- CreateEnum
CREATE TYPE "ReleaseJobStatus" AS ENUM ('pending', 'running', 'waiting_for_approval', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "EnvironmentSyncRequestStatus" AS ENUM ('pending', 'accepted', 'failed', 'skipped');

-- CreateTable
CREATE TABLE "releasable_service_mappings" (
    "id" TEXT NOT NULL,
    "service_key" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "releasable_service_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "release_jobs" (
    "id" TEXT NOT NULL,
    "service_key" TEXT NOT NULL,
    "product_id" TEXT,
    "requester_id" TEXT NOT NULL,
    "cancelled_by_id" TEXT,
    "status" "ReleaseJobStatus" NOT NULL DEFAULT 'pending',
    "latest_tag" TEXT NOT NULL,
    "new_tag" TEXT NOT NULL,
    "argocd_tag" TEXT NOT NULL,
    "release_notes" TEXT NOT NULL,
    "release_url" TEXT,
    "ci_status" TEXT,
    "ci_run_url" TEXT,
    "argocd_pr_url" TEXT,
    "argocd_pr_number" INTEGER,
    "bump_outcome" TEXT,
    "bump_run_url" TEXT,
    "merge_queued_at" TIMESTAMP(3),
    "slack_thread_ts" TEXT,
    "slack_channel" TEXT,
    "progress_log" JSONB NOT NULL DEFAULT '[]',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "release_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "environment_syncs" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "application_name" TEXT NOT NULL,
    "request_status" "EnvironmentSyncRequestStatus" NOT NULL DEFAULT 'pending',
    "request_error" TEXT,
    "last_sync_status" TEXT,
    "last_health" TEXT,
    "last_refreshed_at" TIMESTAMP(3),
    "requested_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "environment_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contributor_slack_maps" (
    "github_username" TEXT NOT NULL,
    "slack_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contributor_slack_maps_pkey" PRIMARY KEY ("github_username")
);

-- CreateIndex
CREATE UNIQUE INDEX "releasable_service_mappings_service_key_key" ON "releasable_service_mappings"("service_key");

-- CreateIndex
CREATE INDEX "releasable_service_mappings_product_id_idx" ON "releasable_service_mappings"("product_id");

-- CreateIndex
CREATE INDEX "release_jobs_service_key_created_at_idx" ON "release_jobs"("service_key", "created_at");

-- CreateIndex
CREATE INDEX "release_jobs_requester_id_created_at_idx" ON "release_jobs"("requester_id", "created_at");

-- CreateIndex
CREATE INDEX "release_jobs_status_idx" ON "release_jobs"("status");

-- One active job per service (pending, running, waiting_for_approval)
CREATE UNIQUE INDEX "release_jobs_active_service_key" ON "release_jobs"("service_key")
WHERE "status" IN ('pending', 'running', 'waiting_for_approval');

-- CreateIndex
CREATE UNIQUE INDEX "environment_syncs_job_id_environment_key" ON "environment_syncs"("job_id", "environment");

-- CreateIndex
CREATE INDEX "environment_syncs_job_id_idx" ON "environment_syncs"("job_id");

-- AddForeignKey
ALTER TABLE "releasable_service_mappings" ADD CONSTRAINT "releasable_service_mappings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_jobs" ADD CONSTRAINT "release_jobs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_jobs" ADD CONSTRAINT "release_jobs_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_jobs" ADD CONSTRAINT "release_jobs_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "environment_syncs" ADD CONSTRAINT "environment_syncs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "release_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
