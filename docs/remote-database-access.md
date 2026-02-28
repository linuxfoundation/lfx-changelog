# Remote Database Access (RDS)

> **Note:** Routine migrations are now handled automatically during Helm deployments. See [Database Migrations](./database-migrations.md) for details. This guide is for manual access when needed (debugging, emergency fixes, Prisma Studio).

This guide walks through connecting to the remote PostgreSQL RDS instance in the dev environment to run Prisma migrations and queries.

## Prerequisites

- **AWS CLI v2** with SSO configured for the `lfx-dev-poweruser` profile
- **kubectl** installed
- **Kubeconfig** for the dev EKS cluster saved at `~/.kube/dev-lfx-v2`

If you don't have the kubeconfig file, ask the platform team for access to the `lfx-v2` EKS cluster in `us-west-2` (account `788942260905`).

---

## 1. Authenticate with AWS SSO

```bash
aws sso login --profile lfx-dev-poweruser
```

This opens your browser to complete the SSO flow. Once authenticated, your session is valid for the duration configured by your org (typically 8-12 hours).

## 2. Set the Kubeconfig

Point kubectl to the dev cluster:

```bash
export KUBECONFIG=~/.kube/dev-lfx-v2
```

Verify you can reach the cluster:

```bash
kubectl get namespaces
```

You should see namespaces like `lfx`, `ui`, `argocd`, etc.

## 3. Start the Port Forward

The `lfx` namespace has an `rds-proxy` pod that bridges to the RDS instance. Forward its PostgreSQL port to your local machine:

```bash
kubectl port-forward -n lfx deployment/rds-proxy 5433:5432
```

> **Note:** We use port `5433` locally to avoid conflicting with a local PostgreSQL on `5432`.

Leave this running in a dedicated terminal tab.

## 4. Set DATABASE_URL

In `apps/lfx-changelog/.env`, swap the `DATABASE_URL` to point at the tunnel:

```env
# Comment out the local DB
# DATABASE_URL="postgresql://changelog:changelog_dev@localhost:5432/lfx_changelog?schema=public"

# Use the remote RDS via tunnel
DATABASE_URL="postgresql://changelog:<PASSWORD>@localhost:5433/changelog?schema=public&sslmode=require"
```

The RDS credentials are stored in AWS Secrets Manager:

```bash
aws secretsmanager get-secret-value \
  --profile lfx-dev-poweruser \
  --region us-west-2 \
  --secret-id '/cloudops/rds-managed/lfx-v2/changelog' \
  --query 'SecretString' \
  --output text
```

**Important:** The password may contain special characters that must be percent-encoded for use in a URL connection string. Use a URL encoder or Node.js `encodeURIComponent()` to encode the password before placing it in the `DATABASE_URL`.

## 5. Run Prisma Commands

With the tunnel active and `DATABASE_URL` pointing at it, run Prisma from the app directory:

```bash
cd apps/lfx-changelog

# Check migration status
yarn prisma migrate status

# Apply pending migrations
yarn prisma migrate deploy

# Open Prisma Studio to browse data
yarn prisma studio
```

> **Warning:** `migrate deploy` applies migrations to the remote database. Double-check you're targeting the correct environment before running.

## 6. Clean Up

When you're done:

1. **Restore your `.env`** back to the local database URL
2. **Stop the port forward** with `Ctrl+C` in the terminal running it

---

## Key Differences: Local vs Remote

|               | Local (Docker)                | Remote (RDS)                     |
| ------------- | ----------------------------- | -------------------------------- |
| Host          | `localhost:5432`              | `localhost:5433` (via tunnel)    |
| Database name | `lfx_changelog`               | `changelog`                      |
| SSL           | Not required                  | **Required** (`sslmode=require`) |
| Credentials   | `changelog` / `changelog_dev` | From AWS Secrets Manager         |

## Troubleshooting

### "no pg_hba.conf entry... no encryption"

The RDS requires SSL. Add `&sslmode=require` to your `DATABASE_URL`.

### "Connection terminated unexpectedly"

The port forward likely dropped. Restart it with the `kubectl port-forward` command from step 3.

### AWS credentials expired

Re-run `aws sso login --profile lfx-dev-poweruser`.

### kubectl can't reach the cluster

Make sure `KUBECONFIG` is set: `export KUBECONFIG=~/.kube/dev-lfx-v2`
