# Phase 3 plan

**Phase 1 + 2 status:** estimating, master tables, AI features,
financial reports, multi-tenant scoping foundation, observability,
import flows — all live. App is at app.youngge.com / api at
api.youngge.com. See `PHASE_1_STATUS.md` and `PHASE_2_STATUS.md`.

**Phase 3 goal:** turn YGE App from "Ryan + Brook's back office" into
"the system everyone touches" — agencies, subs, bond agents, the
field crew, and the IRS / DIR side of payroll.

## Five themes

### 1. Portals (highest external-user value)
Three read-mostly portals for outside parties. Already represented
in the schema as `PortalUser` records with role enums:
- **Owner portal** (`EXTERNAL_OWNER`) — agency PM logs in to see
  the projects YGE is running for them: progress, change orders,
  RFIs, photos, daily reports. No edit access — they message the
  YGE PM through the portal if they want a change.
- **Sub portal** (`EXTERNAL_SUB`) — subs see their POs, the lien
  waivers we need them to sign, bid invites we've sent them, and
  payment history. Sign-and-return flow on lien waivers is the big
  win.
- **Bond agent portal** (`EXTERNAL_BOND`) — bond underwriter sees
  YGE's bonding capacity used/available, current jobs, financial
  summary (latest balance sheet + WIP). Faster bond turnaround on
  every new bid.

### 2. Certified Payroll Reports (DIR / federal compliance)
The CPR system from `/certified-payrolls` generates the report;
the gap is the actual DIR A-1-131 form generation + the
DAS-140/141/142 apprentice-ratio forms. This is must-have for any
prevailing-wage job — if we miss a CPR filing on a Caltrans job
we get the contract pulled.

- A-1-131 weekly CPR (hours by classification × prevailing wage
  rate × fringes)
- DAS-140 (notice of contract award to apprenticeship committee)
- DAS-141 (request for dispatch)
- DAS-142 (training fund contributions)
- WH-347 federal CPR for Davis-Bacon jobs
- e-CPR submission to DIR (probably API; if not, file generation
  for upload)

### 3. Payroll Gusto sync
- Read employee roster from Gusto (one-way sync into YGE
  Employees table)
- Push hours per employee per pay period back to Gusto
- Pull paycheck records back so AR/AP cash flow + bank rec sees
  payroll outflows
- Apprentice rates handled via classification mapping

### 4. Mobile app launch
- Apple Developer enrollment ($99/yr, requires verification)
- App Store Connect record + first build via `eas-cli build`
- TestFlight invite for Ryan + Brook + a couple of foremen
- Google Play Console internal track (Android)
- Review cycle (Apple takes a week, Google a day or two)

The mobile app skeleton shipped in Phase 1; this is just the
release plumbing.

### 5. External tenant rollout (multi-company)
The multi-tenant foundation landed in Phase 2 (1421-1432). Phase 3
operationalizes it:
- Real auth → `companyId` resolution (replace the `X-YGE-Company`
  header with a session-cookie lookup)
- Onboarding flow for a second company (form + seed wizard)
- Per-tenant subdomain routing or path-based scoping
- Pricing + billing if YGE wants to white-label this for other
  small heavy-civil contractors

## Order of attack

1. **Owner portal** — biggest external-user value, shortest
   distance from existing data (jobs / dailyReports / photos /
   changeOrders / RFIs are all already there)
2. **Sub portal** — next-biggest value, needs lien-waiver
   sign-and-return flow which uses bundle 1401's signature store
3. **Certified Payroll Reports** — compliance hard-stop for
   prevailing-wage jobs; lots of form-fill plumbing similar to
   the PDF mappings already shipped for Caltrans
4. **Bond agent portal** — small surface, mostly read-only
   financials we already render
5. **Gusto payroll sync** — biggest external dep, defer until
   YGE actually opens a Gusto account
6. **Mobile launch** — gated on Apple Developer verification
7. **External tenant rollout** — defer until at least one
   other contractor signs on

## What's not in Phase 3

- Native mobile features beyond what RN gives us (offline-first,
  background notifications) — Phase 4
- Excel-master complete ingest (manual data entry remains)
- Open-source / multi-tenant SaaS marketing — well past the
  scope of "build YGE's system"

## Definition of done

Phase 3 is "done" when:
- An agency PM can log in at app.youngge.com/portal/owner, see
  their job's progress + photos + RFIs, message the YGE PM, and
  not need YGE to send them anything by email.
- A sub can log in and sign a lien waiver in three clicks.
- A bond agent can log in and download the latest balance sheet
  + WIP without calling Brook.
- Certified payrolls submit to DIR in one click per pay period
  per job.
- Mobile app is in TestFlight + Play Store internal track.

That's a quarter or two of work — same cadence as Phase 2.
