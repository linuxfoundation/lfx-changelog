-- Copyright The Linux Foundation and each contributor to LFX.
-- SPDX-License-Identifier: MIT

-- AlterTable
ALTER TABLE "release_jobs" DROP COLUMN "bump_run_url",
                           ADD COLUMN     "approval_timeout_notified_at" TIMESTAMP(3);
