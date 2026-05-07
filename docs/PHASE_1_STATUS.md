# Phase 1 ship status

Last updated: 2026-05-06 (auto-pilot session totaling ~1360 commits).

## Phase 1 scope (per CLAUDE.md)

1. Estimating module — replaces the Excel job-cost system.
2. Master rate tables (labor, equipment, equipment rental, materials, subs, cost codes) with CA prevailing wage uplift.
3. Plans-to-Estimate AI — upload plan set or spec, get draft estimate.
4. PDF form filler — pre-mapped agency library (CAL FIRE, Caltrans, DIR, IRS, ACORD, counties) with e-sig inline.
5. Auto form filler browser extension — Safari, Edge, Chrome, Firefox.
6. Master business profile — CSLB, DIR, DOT, bonding, insurance, officers, employee profile v1.
7. Basic auth + multi-tenant company model (YGE only at launch; multi-tenant from day one).

## Status

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Estimating module | ✅ Functional | /estimates, /jobs, /drafts, /imported-estimates, /bid-results, /change-orders, /pcos. Full audit binders. |
| 2 | Master rate tables | ✅ Functional | /cost-codes, /equipment-rates, /materials, /vendors, /subs, /dir-rates with sync. |
| 3 | Plans-to-Estimate AI | ✅ Solid | PDF upload, multipass passes, 6 versioned prompts, /drafts history persists every run. |
| 4 | PDF form filler | ⚠️ 15 forms seeded | Coverage: IRS W-9 / W-4, DIR DAS-140 / 141 / 142 / PWC-100, CAL FIRE 720, Caltrans pre-qual, ACORD 25 / 27 / 28 / 30 / 855, USCIS I-9, EDD DE-4. Engine + e-sig inline. More forms can be added with the same `SeedMapping` pattern. |
| 5 | Browser extension | ✅ Buildable | MV3, scans + fills any web form. Per-store packaging script + listing copy + SUBMIT runbook in `apps/browser-extension/`. Submission still requires you to create the developer accounts. |
| 6 | Master business profile | ✅ Functional | /master-profile editor for company, officers, insurance, bonding. Wired to PDF form filler + browser extension. |
| 7 | Auth + multi-tenant | ✅ Functional | Email allowlist + scrypt password + Microsoft SSO + WebAuthn passkeys. Schema is multi-tenant (`companyId` on every model); runtime defaults to `co-yge`. Real multi-tenant gates on Supabase Auth + per-user company resolution. |

## Storage

7 of ~58 stores migrated to Postgres so far:

- `master-profile-store.ts` ✅
- `vendors-store.ts` ✅
- `portal-users-store.ts` ✅
- `drafts-store.ts` (P2E history) ✅
- `pdf-form-mappings-store.ts` ✅
- `bid-results-store.ts` ✅
- `imported-estimates-store.ts` ✅
- `estimates.ts` (route uses Prisma directly) ✅

The remaining ~50 stores live on the Render persistent disk
(mountPath `/var/data`) via per-store `*_DATA_DIR` env vars in
`render.yaml`. Migrations to Postgres can land incrementally — the
Prisma models are all in place (added in bundle 1345) and the cutover
template is well-trodden.

## Production deploy

Files to make a production push:

- `render.yaml` — Render Blueprint for the API. 5GB persistent disk + every per-store DATA_DIR + secret slots.
- `apps/web/vercel.json` — Vercel config with env pinning + security headers.
- `.env.production.example` — copy + paste template for Render + Vercel env tabs.
- `docs/DEPLOY.md` — step-by-step runbook (Supabase → Render → Vercel → DNS → smoke test).
- `.github/workflows/ci.yml` — typecheck + test gating on every PR.

## What needs you (Ryan)

These items can't be done in code — they need accounts, money, or DNS access:

- [ ] **Supabase** — create project at supabase.com, save the
      DATABASE_URL + service-role key (~10 min).
- [ ] **Render** — sign up, point Blueprint at this repo, paste
      secrets in the Environment tab (~15 min).
- [ ] **Vercel** — import GitHub repo, set `apps/web` as the root,
      paste env vars from `.env.production.example` (~10 min).
- [ ] **Anthropic** — confirm billing on console.anthropic.com so
      `ANTHROPIC_API_KEY` works in production.
- [ ] **DNS** — add `CNAME app.youngge.com → cname.vercel-dns.com`
      and `CNAME api.youngge.com → yge-api.onrender.com` in
      Squarespace (~5 min).
- [ ] **Initial migration** — from your laptop with Supabase
      DATABASE_URL in `.env`, run
      `pnpm --filter @yge/db exec prisma migrate deploy &&
       pnpm --filter @yge/db exec prisma db seed` (~2 min).
- [ ] **Microsoft SSO** (optional) — register YGE app at
      portal.azure.com, paste client id / secret / tenant id into
      Render + Vercel env tabs.
- [ ] **Browser-extension stores**:
  - [ ] Chrome Web Store — $5 one-time
  - [ ] Edge Add-ons — free
  - [ ] Firefox AMO — free
  - [ ] Safari — Apple Developer ($99/yr) + Xcode wrap (slowest)

Run `docs/DEPLOY.md` end-to-end and you're live.

## Phase 1.5 / Phase 2 follow-ups

- Migrate the remaining ~50 file-stores to Postgres (mechanical, one
  bundle each, schema models already exist).
- Wire `companyId` from auth context through every store call instead
  of the env default `co-yge`.
- Add Sentry to both web + API.
- Add Playwright e2e suite gated on a preview deploy.
- Phase 2: foreman mobile screens, daily reports + photos in field,
  AP/AR full bookkeeping (the Excel/QBO replacement everyone's
  waiting for).
