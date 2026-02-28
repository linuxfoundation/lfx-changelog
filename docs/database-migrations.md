# Database Migrations

## Automated Migrations (CI/CD)

Database migrations run automatically during Helm deployments via a Kubernetes **pre-install/pre-upgrade Job**. No manual port-forwarding or intervention is needed for routine deploys.

### How It Works

The migration Job is a **Helm hook** — it runs on every `helm upgrade`, regardless of which CI workflow built the image:

- **Dev:** merge to `main` → `docker-build-main.yml` builds image tagged `development` → Helm upgrade → migration Job runs
- **Prod:** git tag push → `docker-build-tag.yml` builds versioned image → Helm upgrade → migration Job runs

The flow for each deployment:

1. CI builds and pushes the Docker image (containing the latest migration files)
2. Helm upgrade is triggered (via ArgoCD, manual, or CI)
3. A **pre-install/pre-upgrade hook** Job runs before the new pods roll out
4. The Job executes `npx prisma migrate deploy` inside the cluster using the same image and database credentials as the application
5. If the migration succeeds, the Deployment rolls out the new pods
6. If the migration fails, Helm aborts the upgrade and the existing pods continue running

### Migration Job Details

The Job is defined in `charts/lfx-changelog/templates/migration-job.yaml`:

- **Helm hooks:** `pre-install,pre-upgrade` — runs before both first install and subsequent upgrades
- **Retries:** Up to 4 attempts (1 initial + 3 retries, `backoffLimit: 3`) for transient failures (e.g. brief DB connectivity issues)
- **Timeout:** 2-minute hard deadline (`activeDeadlineSeconds: 120`)
- **Cleanup:** Previous migration Jobs are deleted before creating a new one (`before-hook-creation` policy)
- **Credentials:** Reuses the same `environment` block from `values.yaml` — no additional secret configuration needed

### Monitoring Migration Jobs

```bash
# List migration jobs
kubectl get jobs -n <namespace> | grep migrate

# View logs from the latest migration
kubectl logs -n <namespace> job/<release-name>-lfx-changelog-migrate-<revision>

# Check job status
kubectl describe job -n <namespace> <release-name>-lfx-changelog-migrate-<revision>
```

### What `prisma migrate deploy` Does

- Applies **only pending migrations** that haven't been run yet (idempotent)
- Uses PostgreSQL advisory locks to prevent concurrent migration runs
- Never generates new migration files — it only applies existing ones from `prisma/migrations/`
- Reads the migration history from the `_prisma_migrations` table in the database

### Failure Scenarios

| Scenario                  | Behavior                                                               |
| ------------------------- | ---------------------------------------------------------------------- |
| DB unreachable            | Job retries up to 3 times, then fails. Helm aborts upgrade.            |
| Bad migration SQL         | Job fails immediately. Helm aborts upgrade. Old pods stay running.     |
| Timeout (>2 min)          | Job is killed. Helm aborts upgrade.                                    |
| Migration already applied | `prisma migrate deploy` is a no-op. Job succeeds. Deployment proceeds. |

### Docker Image Requirements

The production Docker image includes the files needed for `prisma migrate deploy`:

- `prisma/` — schema and migration SQL files
- `prisma.config.ts` — Prisma CLI configuration
- `src/server/helpers/build-connection-string.ts` — database URL builder (used by the config)
- `src/server/server-logger.ts` and `src/server/helpers/error-serializer.ts` — logger dependencies

These are copied in the Dockerfile's production stage alongside the built application.

---

## Manual Migrations (Local Development)

For local development with the Docker Compose PostgreSQL instance:

```bash
# Start local database
docker compose up -d postgres

# Create a new migration (always use --create-only first)
cd apps/lfx-changelog
yarn prisma migrate dev --create-only --name <migration_name>

# Add the license header to the generated migration.sql, then apply
yarn prisma migrate dev

# Check migration status
yarn prisma migrate status
```

> **Important:** Always use `--create-only` first to avoid checksum mismatches. See the `CLAUDE.md` section on Prisma migrations for the full workflow.

## Manual Migrations (Remote Database)

For cases where you need to run migrations manually against the remote RDS instance (e.g. debugging, emergency fixes), see [Remote Database Access](./remote-database-access.md).
