# Phase 3 status — 2026-05-10

Phase 3 has shipped 26 bundles across two sittings (1478-1503).
Major themes covered:

## Foundation — DONE
- **Phase 3 plan** (1478) — 5 themes ranked by leverage:
  portals → CPRs → Gusto → mobile → external tenant rollout
- **3 external portal roles** + `portal:owner/sub/bond`
  permissions (1479-80)
- **`/portal`** role-aware redirect landing (1487)

## Portals — DONE (read-only v1)
- **`/portal/owner`** — agency PM landing + per-project view with
  daily reports, photos, RFIs, change orders (1481-83)
- **`/portal/owner/photos/[id]`** — read-only photo detail with
  metadata, GPS, caption (1498)
- **`/portal/sub`** — sub landing with Vendor record match by
  email + §4104 sub-bid listings showing where YGE has placed this
  vendor on a bid sheet (1484, 1499)
- **`/portal/bond`** — bonding capacity, % used, active jobs
  (1485)
- Sidebar preview links for internal admins to QA each portal

## Compliance forms — DONE (browser-print to PDF)
- **`/certified-payrolls/[id]/print`** — DIR A-1-131 / federal
  WH-347 layout (1486)
- **`/jobs/[id]/das-140`** — Notice of Contract Award (1489)
- **`/jobs/[id]/das-141`** — Request for Dispatch (1490)
- **`/jobs/[id]/das-142`** — Training Fund Contributions (1491)
- **`/jobs/[id]/bid-invite`** — sub bid invitation letter (1497)
- All four linked from `/jobs/[id]` Compliance forms section,
  alongside a "+ Start this week's CPR" button that pre-fills
  the new-CPR form with the job id (1492, 1502)

## Gusto integration — SCAFFOLDED
- **`apps/api/src/lib/gusto.ts`** — Bearer-auth wrapper for the
  Gusto v1 API (1493)
- **`GET /api/gusto/status`** + **`GET /api/gusto/employees`** —
  no-op when env vars aren't set (1493)
- **`/admin/gusto`** page with status banner + employee match
  preview against YGE Employee records by normalized name (1494)
- Setup steps inline so the office can wire it up themselves

## Dashboard tiles (Brook's morning glance)
- **CPR-due tile** — active prevailing-wage jobs missing this
  week's CPR (1496)
- **CPR pipeline status tile** — DRAFT / SUBMITTED / ACCEPTED /
  REJECTED / AMENDED counts (1501)
- **External portal activity tile** — count of agency / sub /
  bond agent users + preview links (1500)

## Not yet started
- **Sub portal: lien-waiver sign-and-return flow** — needs the
  LienWaiver schema to grow a "claimant=sub" mode + a reusable
  signature flow tied to portal users
- **DIR e-CPR API submission** — currently manual print + mail /
  e-file. API auto-submission ships once we have a test DIR
  account
- **Mobile app TestFlight + Play Store** — gated on Apple
  Developer verification step from Ryan
- **External tenant rollout** — defer until a second contractor
  signs on
- **Gusto two-way sync** (push hours + pull paychecks) — gated
  on YGE opening a real Gusto account

## What Ryan + Brook can do today

After Render + Vercel auto-deploy the latest commit:

1. **External users:** invite via `/admin/portal-users`. Owners
   land on `/portal/owner`, subs on `/portal/sub`, bond agents on
   `/portal/bond`. Read-only — all writes still go through
   internal flows.
2. **Compliance per job:** on `/jobs/[id]`, the Compliance forms
   section has DAS-140/141/142 + bid invitation + "Start this
   week's CPR" — every link opens a print-ready page.
3. **Morning glance:** `/dashboard` has CPR-due + CPR pipeline +
   external portal activity tiles. One scroll tells you what
   needs attention this week.
4. **Gusto onboarding:** set `GUSTO_API_KEY` + `GUSTO_COMPANY_UUID`
   in Render → `/admin/gusto` shows matched employees.

## Phase 3 round-up

26 bundles, two sittings. Same cadence as Phase 2. Next obvious
wins (in order):

1. Sub portal lien-waiver sign-and-return (the one external-portal
   write-back) — schema work + signature flow
2. DIR e-CPR API submission (DIR test account dependency)
3. Mobile launch (Apple Developer dependency)
4. Gusto two-way sync (real Gusto account dependency)

External-dep blockers are why these are deferred — the YGE side
is ready; we just need the upstream account or verification step
done.
