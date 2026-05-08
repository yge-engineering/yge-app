# Phase 3 status — 2026-05-07 (evening checkpoint)

Phase 2 wrapped earlier today. Phase 3 kicked off this afternoon
and shipped 18 bundles in a single sitting.

## Foundation — DONE
- **Phase 3 plan doc** (1478) — five themes ranked by leverage:
  portals → CPRs → Gusto → mobile → external tenant rollout
- **EXTERNAL_OWNER / EXTERNAL_SUB / EXTERNAL_BOND** portal roles +
  `portal:owner` / `:sub` / `:bond` permissions (1479-80)
- **`/portal`** role-aware redirect landing — owners go to
  `/portal/owner`, subs to `/portal/sub`, etc. (1487)
- Sidebar preview links for internal admins to QA each portal

## Portals — DONE (read-only v1)
- **`/portal/owner`** — assigned-jobs grid (1481)
- **`/portal/owner/jobs/[id]`** — per-project view: project summary,
  recent daily reports, photos, open RFIs, change orders. Auth gate
  verifies the user is in the job's `assignedJobIds` (1482-83)
- **`/portal/sub`** — account info + Vendor record match by email
  + W-9 status (1484)
- **`/portal/bond`** — bonding capacity, % used vs. aggregate limit,
  active jobs list (1485)
- All four pages: minimal chrome (no AppShell), one CTA back to
  `office@youngge.com` for anything they can't do themselves

## Compliance — DONE (printable layouts)
- **`/certified-payrolls/[id]/print`** — DIR A-1-131 / federal
  WH-347 layout with statement of compliance + week totals (1486)
- **`/jobs/[id]/das-140`** — Notice of Contract Award to
  Apprenticeship Committee (1489)
- **`/jobs/[id]/das-141`** — Request for Dispatch of Apprentices
  (1490)
- **`/jobs/[id]/das-142`** — Training Fund Contributions (1491)
- All four linked from `/jobs/[id]` under a "Compliance forms"
  section (1492)
- Browser-print to PDF; the office hand-fills the per-trade
  blanks before mailing

## Gusto integration — SCAFFOLDED
- **`apps/api/src/lib/gusto.ts`** — thin Bearer-auth wrapper for
  the Gusto v1 API (`listEmployees` so far) (1493)
- **`GET /api/gusto/status`** + **`GET /api/gusto/employees`** —
  no-op when `GUSTO_API_KEY` + `GUSTO_COMPANY_UUID` env vars aren't
  set (1493)
- **`/admin/gusto`** page — status banner + employee match preview
  matching Gusto employees against YGE Employee records by
  normalized name. `nav.adminGusto` link in the Financials
  group (1494)
- Setup steps written into the page so the office can wire it up
  themselves once Brook signs YGE up for Gusto

## Not yet started
- **Sub portal: lien-waiver sign-and-return flow** — requires the
  LienWaiver schema to grow a "claimant=sub" mode + a reusable
  signature flow tied to the portal user
- **DIR e-CPR API submission** — currently the bookkeeper prints
  + mails / e-files manually. API auto-submission ships once we
  have a test DIR account
- **Mobile app TestFlight + Play Store** — needs Apple Developer
  verification step from Ryan
- **External tenant rollout** — defer until a second contractor
  signs on

## What can Ryan + Brook do today?

After Render + Vercel auto-deploy `dbf9837`:

- Invite an agency PM with role `EXTERNAL_OWNER` + relevant
  `assignedJobIds` checked → they sign in + land on `/portal/owner`
  → click a project → see daily reports, photos, RFIs, change
  orders.
- Invite a sub vendor with `EXTERNAL_SUB` → they sign in + see
  their Vendor record match + W-9 status.
- Invite a bond agent with `EXTERNAL_BOND` → they sign in + see
  capacity utilization + active jobs.
- For any prevailing-wage job, click into `/jobs/[id]` →
  Compliance forms section → print DAS-140/141/142 + the CPR
  printable for the week.
- Set `GUSTO_API_KEY` + `GUSTO_COMPANY_UUID` in Render → reload
  `/admin/gusto` → see the matched employees pull in.

## Phase 3 round-up

18 bundles in this sitting. Same ratio as Phase 2's foundations
day. Next sitting should aim at:
1. Sub portal lien-waiver flow (the one external-portal feature
   that has actual write-back, not just read)
2. Mobile launch wiring once Ryan finishes Apple Developer
3. The "two-way" half of Gusto sync (push hours + pull paychecks)
   when YGE has a real Gusto account.
