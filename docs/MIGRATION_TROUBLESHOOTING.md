# Production Migration Drift — 2026-05-13

## Symptoms

On 2026-05-13, the `/api/priced-estimates`, `/api/estimates`, and
`/api/admin/errors` endpoints all returned 500 in production with:

```
PrismaClientKnownRequestError: The column `estimates.data` does not
exist in the current database.
```

```
PrismaClientKnownRequestError: The table `public.api_errors` does
not exist in the current database.
```

## Root cause

Production Postgres had only 2 migrations recorded in
`_prisma_migrations`:

  - `20260506000000_init`
  - `20260507000000_add_data_json`

But the code had **8 migrations** on disk. The 6 unrecorded migrations
were never applied to the production database:

  - `20260507010000_audit_reason`         (ALTER TABLE audit_events)
  - `20260507020000_equipment`            (CREATE TABLE equipment_assets)
  - `20260507030000_dir_rate_proposals`   (CREATE TABLE dir_rate_proposals)
  - `20260507040000_job_customer_nullable`(ALTER COLUMN jobs.customerId)
  - `20260507050000_estimate_data_json`   (ADD COLUMN estimates.data)
  - `20260507060000_api_errors`           (CREATE TABLE api_errors)

## Why was prisma migrate deploy not running?

`render.yaml` declares the buildCommand as:

```
pnpm install --frozen-lockfile &&
pnpm --filter @yge/db exec prisma generate &&
pnpm --filter @yge/db exec prisma migrate deploy &&
pnpm --filter @yge/api build
```

If `prisma migrate deploy` had failed, the `&&` chain would have
broken the build. But deploys succeeded. Likely causes (need to be
verified manually in the Render UI):

1. **Render dashboard override.** The buildCommand can be overridden
   in the Render Service Settings → Build & Deploy → Build Command.
   Check whether that field matches `render.yaml`. If someone edited
   it to remove `prisma migrate deploy`, deploys would succeed
   without applying migrations.

2. **DIRECT_URL pointing at the wrong DB.** Prisma's `migrate deploy`
   uses `DIRECT_URL` (session connection, port 5432) instead of
   `DATABASE_URL` (pooler, port 6543). If DIRECT_URL points at a
   different/stale DB (e.g. an old Supabase project), migrations
   would apply to the wrong place and runtime queries would see the
   stale schema. Verify DIRECT_URL in Render env vars matches the
   actual production Supabase project.

3. **Silent skip on duplicate migration name.** Less likely, but if
   `_prisma_migrations` had ever held a row marking these as applied
   without the SQL having run, migrate deploy would skip them. The
   row we recorded today wasn't there before, so this isn't it.

## Fix (2026-05-13)

Bundles 1578 → 1581 (now removed in 1582) diagnosed and patched
production:

1. `/api/admin/health/debug/probe` exposed the actual Prisma
   PrismaClientKnownRequestError messages.
2. `/api/admin/health/debug/migrations-state` read `_prisma_migrations`
   and showed only 2 of 8 migrations were recorded.
3. `/api/admin/health/debug/fix-migration-state` ran each missing
   migration's SQL inline (all are idempotent — `IF NOT EXISTS` /
   `DROP NOT NULL`) AND inserted the 6 missing `_prisma_migrations`
   rows.

After 1581, production `_prisma_migrations` matches code.

## Follow-up actions

- Verify Render buildCommand in dashboard matches `render.yaml`.
- Verify `DIRECT_URL` env var on Render points at the same Supabase
  project as `DATABASE_URL`.
- Consider adding a startup check that fails fast if Prisma's
  `_prisma_migrations` doesn't include every migration on disk.
- The 3 pre-existing failing test files (`audit-store.test.ts`,
  `estimates-store.test.ts`, `jobs-store.test.ts`) need Testcontainers
  before they can run against the post-cutover Postgres code.

## How to detect this earlier next time

If a Prisma-backed endpoint suddenly 500s:

```
curl https://api.youngge.com/api/admin/health/data-counts
```

If that works (proves Prisma connection is healthy) but specific
endpoints still 500, the cause is almost certainly missing migrations
on those tables. Look at the actual error message in Render logs.
