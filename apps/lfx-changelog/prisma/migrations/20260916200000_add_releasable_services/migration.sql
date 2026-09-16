-- Copyright The Linux Foundation and each contributor to LFX.
-- SPDX-License-Identifier: MIT

-- CreateEnum
CREATE TYPE "DeploymentType" AS ENUM ('standalone', 'platform_subchart');

-- CreateTable
CREATE TABLE "releasable_services" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deployment_type" "DeploymentType" NOT NULL,
    "app_name" TEXT,
    "argocd_repo" TEXT,
    "environments" TEXT[] DEFAULT ARRAY['staging', 'prod']::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "releasable_services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "releasable_services_repository_id_key" ON "releasable_services"("repository_id");

-- AddForeignKey
ALTER TABLE "releasable_services" ADD CONSTRAINT "releasable_services_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "product_repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- aliases and environments are non-nullable String[] in the Prisma model, but the generated DDL
-- leaves the columns nullable, so a direct insert could produce a row the client types as an
-- array. Same correction applied to contributors.emails in 20260914120000 and api_keys.scopes in
-- 20260301041627.
ALTER TABLE "releasable_services" ALTER COLUMN "aliases" SET NOT NULL;
ALTER TABLE "releasable_services" ALTER COLUMN "aliases" SET DEFAULT '{}';
ALTER TABLE "releasable_services" ALTER COLUMN "environments" SET NOT NULL;
ALTER TABLE "releasable_services" ALTER COLUMN "environments" SET DEFAULT ARRAY['staging', 'prod']::TEXT[];
