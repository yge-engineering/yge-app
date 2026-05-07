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

## What's next

Phase 2 plan order:

1. **Foundations** ✓ — store migration done, Supabase Storage
   helper shipped (1383), bank-rec matcher library shipped (1370)
2. **AP invoice AI extract** ✓ — already in production
3. **Bank rec auto-match UI** — the matcher library is ready;
   needs the consumer page (CSV upload → match table → confirm)
4. **Daily report narrative + photos** — narrative AI not yet
   wired; photo capture works through the storage helper
5. **Bookkeeping completion** — financial reports need GL math
6. **Payroll Gusto sync** — deferred
7. **Portals + email intelligence** — deferred

## Things still on the file system (ok to leave)

- `audit-store` row JSON files on Render's `/var/data/audit-events/`
  from before the cutover — kept as a backup snapshot. Newly-recorded
  events go straight to Postgres.
- Old estimate JSON files under `/var/data/estimates/` — same story.

Both are inert post-cutover. A later sweep can move them off the
disk into Supabase Storage as cold-storage archives.
