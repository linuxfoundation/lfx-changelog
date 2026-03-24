---
paths:
  - 'prisma/**'
  - 'packages/shared/src/schemas/**'
  - 'apps/lfx-changelog/src/server/**'
---

# Prisma Migrations (CRITICAL)

When creating Prisma migrations, **always use `--create-only` first** to avoid checksum mismatches:

1. `yarn prisma migrate dev --create-only --name <migration_name>` — generates the SQL file without applying
2. Add the license header to the generated `migration.sql` file:

   ```sql
   -- Copyright The Linux Foundation and each contributor to LFX.
   -- SPDX-License-Identifier: MIT
   ```

3. `yarn prisma migrate dev` — applies the migration (checksum now includes the header)

**NEVER** run `yarn prisma migrate dev --name <name>` directly — it generates and applies in one step, meaning the checksum won't include the license header and modifying the file afterward causes integrity errors on production deploys.

**`migration_lock.toml`** is auto-managed by Prisma and overwritten on every migration command. After running any migration, check if its license header was stripped and re-add it if needed:

```toml
# Copyright The Linux Foundation and each contributor to LFX.
# SPDX-License-Identifier: MIT
```
