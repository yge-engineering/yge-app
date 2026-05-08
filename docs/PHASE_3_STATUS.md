# Phase 3 status — 2026-05-07 (kickoff)

Phase 2 wrapped (see `PHASE_2_STATUS.md`). Phase 3 started this
afternoon. First batch of bundles shipped:

## Foundation — DONE
- **EXTERNAL_OWNER / EXTERNAL_SUB / EXTERNAL_BOND** portal roles
  added to the PortalRole enum + ROLE_PERMISSIONS wiring (1479-80)
- **portal:owner / portal:sub / portal:bond** permissions added
- **`/portal`** role-aware redirect landing — owners go to
  `/portal/owner`, subs to `/portal/sub`, etc. (1487)
- Sidebar preview links for internal admins to QA each portal

## Owner portal — DONE (read-only)
- **`/portal/owner`** landing — assigned-jobs grid, sorted by
  most recent first, project status + bid-due chip per card (1481)
- **`/portal/owner/jobs/[id]`** per-job view — project summary,
  recent daily reports (last 10), recent photos (last 12), open
  RFIs, change orders. Auth gate verifies the user is in the
  job's `assignedJobIds` (1482-83)
- No AppShell — external users get a clean, minimal chrome

## Sub portal — STARTED
- **`/portal/sub`** landing — account info + Vendor record match
  by email + W-9 status (1484)
- TODO: lien-waiver sign-and-return flow (uses bundle 1401's
  signature store)
- TODO: open POs / bid invites / payment history once those
  data streams gain a sub-facing view

## Bond agent portal — DONE
- **`/portal/bond`** — bonding capacity (single-job + aggregate
  limits), capacity utilization (% used vs. aggregate), active
  jobs list (1485)
- TODO: WIP + balance sheet inline (currently bond agent has to
  follow links elsewhere)

## Certified payrolls — STARTED
- **`/certified-payrolls/[id]/print`** — DIR A-1-131 / federal
  WH-347 layout. Browser-print to PDF. Includes statement of
  compliance block + week totals (1486)
- TODO: official DIR fillable PDF template fill via existing
  pdf-form-mappings infrastructure
- TODO: DAS-140 / DAS-141 / DAS-142 apprentice forms
- TODO: e-CPR API submission to DIR (currently manual upload)

## Not yet started
- **Payroll Gusto sync** (deferred until YGE has a Gusto account)
- **Mobile app launch** (deferred — needs Apple Developer
  verification step)
- **External tenant rollout** (deferred — only YGE for now)

## What can Ryan do today?

After Render + Vercel finish auto-deploying commit 8292869:

1. Visit `/admin/portal-users`, invite an agency PM with role
   `EXTERNAL_OWNER` and the relevant `assignedJobIds` checked.
2. They sign in and land on `/portal/owner` automatically.
3. They click a project card → land on the read-only project
   view with daily reports + photos + RFIs.
4. Same workflow for subs (`/portal/sub`) and bond agent
   (`/portal/bond`).

Internal users (PRESIDENT/VP) can preview each portal from the
sidebar's new "Portal: Owner / Sub / Bond (preview)" links
under the Financials group.
