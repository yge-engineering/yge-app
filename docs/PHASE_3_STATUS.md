# Phase 3 status — 2026-05-10

Phase 3 has shipped 33 bundles across multiple sittings (1478-1510).

## Foundation — DONE
- Phase 3 plan doc + 3 external portal roles + permissions
- Role-aware /portal redirect landing
- Sidebar preview links for internal admins

## Owner portal — DONE (multi-page read-only)
- **`/portal/owner`** — landing with quick-stats strip (photos last
  7d / open RFIs / pending change orders) + project grid with
  per-card activity chips ("Last report: 3d ago" / "Last photo:
  today") + bid-due countdowns
- **`/portal/owner/jobs/[id]`** — full project view: summary,
  recent daily reports, recent photos (12), open RFIs (10), change
  orders (10) with "See all" links to the sub-pages
- **`/portal/owner/jobs/[id]/photos`** — full photo gallery grouped
  by month
- **`/portal/owner/jobs/[id]/rfis`** — full RFI list grouped by
  status (open / answered / closed)
- **`/portal/owner/photos/[id]`** — read-only photo detail with
  metadata, GPS, caption
- Auth gates verify the user is in the job's `assignedJobIds` at
  every layer

## Sub portal — Read-only context
- **`/portal/sub`** — landing with account info + Vendor record
  match by email + §4104 sub-bid listings + lien waivers filed
  by YGE
- TODO: sub sign-and-return flow on lien waivers (schema work)

## Bond portal — DONE (5 sections)
- **`/portal/bond`** — bonding capacity, capacity utilization gauge,
  active jobs, completed jobs this year (track record), latest
  financial summary (assets / liabilities / equity from posted
  journal entries)

## Compliance forms — DONE (browser-print to PDF)
- `/certified-payrolls/[id]/print` — DIR A-1-131 / WH-347 layout
- `/jobs/[id]/das-140` — Notice of Contract Award
- `/jobs/[id]/das-141` — Request for Dispatch
- `/jobs/[id]/das-142` — Training Fund Contributions
- `/jobs/[id]/bid-invite` — sub bid invitation letter
- All linked from `/jobs/[id]` Compliance section, plus
  "+ Start this week's CPR" button that opens the new-CPR form
  pre-filled with the job id

## Gusto integration — SCAFFOLDED
- `apps/api/src/lib/gusto.ts` Bearer-auth wrapper
- `GET /api/gusto/status` + `GET /api/gusto/employees` (no-op
  when env vars not set)
- `/admin/gusto` page with status banner + employee match
  preview against YGE Employee records

## Dashboard tiles (Brook's morning glance)
- **CPR-due** — active prevailing-wage jobs missing this week's CPR
- **CPR pipeline status** — DRAFT / SUBMITTED / ACCEPTED / REJECTED
  / AMENDED counts
- **External portal activity** — counts of owner / sub / bond agent
  users + preview links

## Not yet started (external-dep blocked)
- **Sub portal lien-waiver sign-and-return** — needs LienWaiver
  schema redesign for sub-as-claimant
- **DIR e-CPR API submission** — DIR test account needed
- **Mobile app TestFlight + Play Store** — Apple Developer
  verification needed
- **Gusto two-way sync** (push hours + pull paychecks) — real
  Gusto account needed
- **External tenant rollout** — second contractor signup needed

## What Ryan + Brook + an external user can do today

After Render + Vercel auto-deploy the latest commit:

**Internal users:**
- Invite an external user via `/admin/portal-users` with role
  `EXTERNAL_OWNER` / `EXTERNAL_SUB` / `EXTERNAL_BOND`
- Watch the dashboard tiles: CPR-due + pipeline status +
  external portal activity
- Print DAS-140/141/142 + bid invitation + CPR per job from the
  Compliance forms section on `/jobs/[id]`
- Click "+ Start this week's CPR" to open a pre-filled new-CPR
  form

**Owner portal user:** lands on `/portal/owner`, scans quick stats
+ project grid, clicks a project, sees daily reports / photos /
RFIs / change orders, clicks into the full photo gallery or RFI
list, clicks a photo for the detail view.

**Sub portal user:** lands on `/portal/sub`, sees account info,
sub-bid listings, lien waivers filed by YGE.

**Bond agent:** lands on `/portal/bond`, sees capacity / active
jobs / completed jobs / financial summary.

## Phase 3 round-up

33 bundles. Most external-facing functionality is now live; the
remaining work is gated on external dependencies (DIR test
account, Apple Developer verification, real Gusto account,
lien-waiver schema redesign). The YGE side is ready and
shipping as fast as the watcher + typecheck cycle allows.
