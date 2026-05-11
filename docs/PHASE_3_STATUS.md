# Phase 3 status — 2026-05-10

Phase 3 has shipped 40 bundles (1478-1517). Themes covered:

## Foundation — DONE
- Phase 3 plan doc + 3 external portal roles + portal:* perms
- `/portal` role-aware redirect landing
- Sidebar preview links for internal admins

## Owner portal — DONE (8-page read-only experience)
- **`/portal/owner`** — landing with quick-stats strip (photos 7d /
  open RFIs / pending change orders) + project grid with per-card
  activity chips ("Last report: 3d ago" / "Last photo: today") +
  bid-due countdowns
- **`/portal/owner/jobs/[id]`** — full project view
- **`/portal/owner/jobs/[id]/photos`** — gallery grouped by month
- **`/portal/owner/jobs/[id]/rfis`** — grouped by status (open /
  answered / closed)
- **`/portal/owner/jobs/[id]/change-orders`** — grouped by status
  (pending / approved / rejected) + approved total
- **`/portal/owner/jobs/[id]/daily-reports`** — grouped by month
  with weather + issues + visitors
- **`/portal/owner/jobs/[id]/submittals`** — submittals listed
  with spec section + status
- **`/portal/owner/photos/[id]`** — photo detail with GPS + metadata
- All pages gate on `assignedJobIds` at every layer

## Sub portal — Read-only context
- **`/portal/sub`** — account info + Vendor record match by email
  + §4104 sub-bid listings + lien waivers filed by YGE
- **`/portal/sub/estimates/[id]`** — read-only sub-bid listing
  detail per estimate
- TODO (gated): sign-and-return flow on lien waivers requires
  LienWaiver schema redesign

## Bond portal — DONE (6 sections + detail page)
- **`/portal/bond`** — bonding capacity, utilization gauge, active
  jobs, completed-this-year track record, latest financial summary
- **`/portal/bond/jobs/[id]`** — contract amount tracking (base /
  CO impact / current total)

## Compliance forms — DONE (browser-print to PDF)
- `/certified-payrolls/[id]/print` (DIR A-1-131 / WH-347)
- `/jobs/[id]/das-140` (Notice of Contract Award)
- `/jobs/[id]/das-141` (Request for Dispatch)
- `/jobs/[id]/das-142` (Training Fund Contributions)
- `/jobs/[id]/bid-invite` (sub bid invitation letter)
- All linked from `/jobs/[id]` Compliance section
- "+ Start this week's CPR" button pre-fills the new-CPR form

## Gusto integration — SCAFFOLDED
- `apps/api/src/lib/gusto.ts` Bearer-auth wrapper
- `/api/gusto/status` + `/api/gusto/employees` (no-op when env
  vars not set)
- `/admin/gusto` page with status banner + employee match preview

## Dashboard tiles (internal admins)
- **CPR-due** — active prevailing-wage jobs missing this week's CPR
- **CPR pipeline status** — DRAFT / SUBMITTED / ACCEPTED / REJECTED
  / AMENDED counts
- **External portal activity** — counts of owner / sub / bond agent
  users + preview links

## Not started (external-dep blocked)
- Sub portal lien-waiver sign-and-return (schema redesign)
- DIR e-CPR API submission (test account)
- Mobile app TestFlight + Play Store (Apple Developer verification)
- Gusto two-way sync (real Gusto account)
- External tenant rollout (second contractor signup)

## What Ryan + Brook + external users can do today

After Render + Vercel auto-deploy the latest commit:

**Internal:**
- Invite external users via `/admin/portal-users`
- Watch the dashboard's CPR + portal-activity tiles
- Print compliance forms + CPR from `/jobs/[id]`
- Click "+ Start this week's CPR" for one-click pre-filled new
- Configure `GUSTO_API_KEY` + `GUSTO_COMPANY_UUID` → see matched
  employees in `/admin/gusto`

**Owner portal user:** lands on `/portal/owner`, drills into each
project's daily reports / photos / RFIs / change orders / submittals
through a clean read-only chrome.

**Sub portal user:** lands on `/portal/sub`, sees their account
status + §4104 sub-bid listings, clicks into per-estimate details.

**Bond agent:** lands on `/portal/bond`, drills into per-job
financial impact tracking.

## Phase 3 round-up

40 bundles in one extended sitting (1478-1517). The shipping
cadence has stayed at ~1 bundle / 1-2 minutes across the
typecheck + git push loop. Same productivity ratio as Phase 2's
multi-day push.

Next sitting work depends on you unblocking:
1. DIR test account (e-CPR API submission)
2. Apple Developer verification (mobile launch)
3. Real Gusto account (two-way sync)
4. LienWaiver schema redesign (sub sign-and-return)

Until then, Phase 3 is shipped.
