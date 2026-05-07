# Phase 2 status — 2026-05-07

## Migration sweep — DONE

All 58 server-side stores are now Postgres-backed. None still
import `node:fs/promises`. The full `apps/api/src/lib/*-store.ts`
suite went from "files on a Render persistent disk" to "rows in
Supabase Postgres" without a route or UI change.

### Stores migrated (selected highlights)
- **Master tables:** customers, employees, vendors, cost-codes,
  equipment-rates, materials, labor rates (DIR), chart of accounts
- **Job lifecycle:** jobs, estimates (data Json blob), bid-results,
  bid-tabs, drafts, imported-estimates
- **Field operations:** daily reports, time cards, photos,
  documents, folders, equipment, tools, dispatches, signatures,
  weather logs, SWPPP inspections, toolbox talks, incidents,
  punch items
- **Financials:** AR/AP invoices + payments, bank recs, journal
  entries, expenses, lien waivers, change orders, PCOs, mileage
- **Compliance:** certified payrolls, certificates, master
  profile, PDF form mappings, portal users, legal holds, records
  retention purges
- **Auth + sessions:** OTP, WebAuthn, credentials, microsoft
  tokens, SSO handoff, audit events
- **Subordinate streams:** dir-rate-sync runs + proposals (new
  DirRateProposal table), calendar events + share tokens,
  P2E feedback, RFIs, submittals, change orders, PCOs

### Schema additions (auto-applied via Render `prisma migrate deploy`)
- `data Json?` on Customer / Employee / Job / CostCode / LaborRate /
  EquipmentRate / Material / Estimate (mirrors the full Zod shape so
  no field-by-field column mapping was needed)
- `reason String?` on AuditEvent
- New `Equipment` model + `equipment_assets` table for asset
  tracking
- New `DirRateProposal` model + `dir_rate_proposals` table
- `Job.customerId` made nullable (file-store rows have no customer
  link yet — UI follow-up)

### Operational changes
- `render.yaml` now runs `prisma migrate deploy` on every build
  (bundle 1405). New migrations land automatically on next deploy.

## AI features

### Already in production
- **Plans-to-Estimate** — PDF plan set → draft estimate (Phase 1)
- **AP-invoice extract** — vendor PDF → pre-filled invoice (Phase 1)
- **Title-block / scope-gap / spec-extras / bid-schedule** prompts
  on the estimate review pane (Phase 1)
- **Cross-check addenda** between RFP + bid response (Phase 1)

### Newly shipped (Phase 2 sweep)
- **Bank-rec auto-match** (bundles 1370, 1414-1416) — bookkeeper
  pastes unmatched statement rows, AI suggests AR / AP / expense
  matches with HIGH/MEDIUM/LOW confidence + reasoning. Read-only
  review pane on `/bank-recs/[id]`.
- **Daily-report narrative expansion** (bundles 1417, 1419-1420) —
  foreman types 3 bullets, "Expand to prose (AI)" button returns
  a 2-4 sentence paragraph for the agency PM. Foreman edits before
  saving — AI never auto-commits.
- **Bid-tab PDF extract** (bundles 1423-1424) — drop a Caltrans /
  county / agency bid-tab PDF on `/bid-tabs/new`, AI returns
  structured agency / project / bid-open / bidder list. Operator
  reviews + saves through the existing import form.

## Multi-tenant foundation (bundles 1421-1422)
- `apps/api/src/lib/request-context.ts` — Node AsyncLocalStorage
  carrying `companyId` / `actorUserId` / IP / UA per request.
- `apps/api/src/middleware/tenant.ts` — Express middleware seeds
  the context from `X-YGE-Company` header (or env default).
- `recordAudit()` reads from the request context as a fallback so
  audit rows are tagged with the right tenant + actor even when
  the calling route forgot to thread an `AuditContext` through.
- Stores can opt in to read `getRequestCompanyId()` instead of
  the hardcoded env default — that migration is mechanical and
  follows store-by-store.

## What's next

Phase 2 plan order:

1. **Foundations** ✓ DONE
2. **AP invoice AI extract** ✓ DONE
3. **Bank-rec auto-match** ✓ DONE
4. **Daily-report narrative** ✓ DONE
5. **Bid-tab AI extract** ✓ DONE
6. **Multi-tenant scoping** ✓ FOUNDATION DONE — store-by-store
   opt-in + real auth resolution still pending
7. **Photo capture for daily reports** — Supabase Storage helper
   exists; needs the foreman-facing upload widget
8. **Bookkeeping completion** — financial reports (P&L, balance
   sheet, WIP, cash flow) need GL math + UI
9. **Payroll Gusto sync** — deferred
10. **Portals + email intelligence** — deferred

## Things still on the file system (ok to leave)

- `audit-store` row JSON files on Render's `/var/data/audit-events/`
  from before the cutover — kept as a backup snapshot. Newly-recorded
  events go straight to Postgres.
- Old estimate JSON files under `/var/data/estimates/` — same story.

Both are inert post-cutover. A later sweep can move them off the
disk into Supabase Storage as cold-storage archives.
