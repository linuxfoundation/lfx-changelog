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

-- A standalone service deploys its own Argo CD application and must name it; a platform subchart
-- has no application of its own, so naming one would be meaningless. Prisma cannot express this,
-- and until a write path exists these rows are inserted directly, so the database is the only
-- thing enforcing it.
ALTER TABLE "releasable_services" ADD CONSTRAINT "releasable_services_app_name_matches_deployment_type" CHECK (
  ("deployment_type" = 'standalone' AND "app_name" IS NOT NULL) OR
  ("deployment_type" = 'platform_subchart' AND "app_name" IS NULL)
);
