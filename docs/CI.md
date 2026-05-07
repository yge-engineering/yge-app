# CI workflow — `.github/workflows/ci.yml`

What it does on every push to `main` and every pull request:

1. Checkout the repo.
2. Install pnpm 9 + Node 20 (with pnpm cache).
3. `pnpm install --frozen-lockfile` — must match the committed lockfile.
4. `prisma generate` — needed before any TS that imports `@yge/db`.
5. `pnpm -r typecheck` — every workspace's `tsc --noEmit` must pass.
6. `pnpm -r test --if-present` — vitest in each workspace that has tests.

What it does NOT do (yet):

- ESLint (we have `pnpm lint` per package; layer on after lint debt is paid down)
- Playwright e2e (needs a running Postgres + the API + Supabase; gate
  this on a future preview-deploy step)
- Build (Vercel does this; if web fails to build, Vercel blocks the
  deploy on PRs already)

## Local equivalents

Run the same checks locally before pushing:

```bash
pnpm install
pnpm --filter @yge/db exec prisma generate
pnpm -r typecheck
pnpm -r test
```

If you only changed one workspace, scope it: `pnpm --filter @yge/web typecheck`.

## Pre-commit hook (optional, recommended)

```bash
# Install a basic husky-style pre-commit hook
cat > .git/hooks/pre-commit <<'HOOK'
#!/usr/bin/env bash
exec pnpm --filter @yge/web typecheck && pnpm --filter @yge/api typecheck
HOOK
chmod +x .git/hooks/pre-commit
```

This catches the obvious "I forgot to typecheck before pushing" case
that's tripped me up multiple times during the autopilot run.
