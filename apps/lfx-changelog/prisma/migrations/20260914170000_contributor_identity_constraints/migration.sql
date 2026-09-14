-- Copyright The Linux Foundation and each contributor to LFX.
-- SPDX-License-Identifier: MIT

-- github_login is mutable (GitHub accounts can be renamed and logins reused),
-- so identity lives on github_user_id alone. Keep a plain index for lookups.
-- slack_user_id becomes UNIQUE so one Slack member maps to one contributor;
-- Postgres permits many NULLs, so unlinked contributors are unaffected.
-- DropIndex
DROP INDEX "contributors_github_login_key";

-- DropIndex
DROP INDEX "contributors_slack_user_id_idx";

-- CreateIndex
CREATE UNIQUE INDEX "contributors_slack_user_id_key" ON "contributors"("slack_user_id");

-- CreateIndex
CREATE INDEX "contributors_github_login_idx" ON "contributors"("github_login");


-- emails is a non-nullable String[] in the Prisma model but the create left the column
-- nullable, so a direct insert could produce a row the client types as an array.
-- Same drift corrected for api_keys.scopes in 20260301041627.
UPDATE "contributors" SET "emails" = '{}' WHERE "emails" IS NULL;
ALTER TABLE "contributors" ALTER COLUMN "emails" SET NOT NULL;
ALTER TABLE "contributors" ALTER COLUMN "emails" SET DEFAULT '{}';
