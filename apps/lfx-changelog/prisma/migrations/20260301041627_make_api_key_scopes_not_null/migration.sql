-- Copyright The Linux Foundation and each contributor to LFX.
-- SPDX-License-Identifier: MIT

-- Backfill any NULL scopes with an empty array, then enforce NOT NULL with a default.
UPDATE "api_keys" SET "scopes" = '{}' WHERE "scopes" IS NULL;
ALTER TABLE "api_keys" ALTER COLUMN "scopes" SET NOT NULL;
ALTER TABLE "api_keys" ALTER COLUMN "scopes" SET DEFAULT '{}';
