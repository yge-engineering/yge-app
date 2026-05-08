# Phase 2 status — 2026-05-07 (afternoon checkpoint)

## Foundations — DONE

- All 58 server-side stores Postgres-backed (no `node:fs/promises`
  in the read path)
- Multi-tenant scoping foundation (AsyncLocalStorage + middleware,
  53 stores opted in to `getRequestCompanyId()`)
- `render.yaml` runs `prisma migrate deploy` on every build
- Observability: `api_errors` Postgres capture + `X-Request-Id`
  correlation + `/admin/errors` page + dashboard server-health tile
- Backfill endpoint (`POST /api/admin/backfill-from-disk`) recovers
  pre-cutover JSON snapshots into Postgres if data was lost during
  the file-store → Postgres migration

## AI features

### Already shipped (chronological)
- **Plans-to-Estimate** — PDF plan set → draft estimate
- **AP-invoice extract** — vendor PDF → pre-filled invoice
- **Title-block / scope-gap / spec-extras / bid-schedule** prompts
  on the estimate review pane
- **Cross-check addenda** between RFP + bid response
- **Bank-rec auto-match** (read panel + Apply HIGH for AP/AR/expense)
- **Daily-report narrative** (bullets → prose)
- **Bid-tab PDF extract** (Caltrans-style → structured JSON)
- **Email triage scaffold** (`POST /api/microsoft/inbox-triage`) +
  dashboard tile + match-to-job suggester + auto-file-to-Outlook-
  folder by job
- **AI bid review** (`POST /api/priced-estimates/:id/review` + 🔍
  button on `/estimates/[id]`)
- **Explain-line** (per-row ❓ explanation in estimate editor)

## Estimate import flow

- `POST /api/priced-estimates/import-csv` — accepts both `.csv` and
  `.xlsx` (via SheetJS). Multi-sheet workbooks return `availableSheets`
  on first POST so the UI can render a sheet picker.
- Required CSV columns: `itemNumber, description, unit, quantity`
  (+ optional `unitPrice`). Header row auto-detected.
- Import dialog has a job dropdown (no more pasting `job-...`),
  per-job "⬆ Import from Excel" button on `/jobs/[id]`, and a
  "Mark imported lines as reviewed" toggle (default on) so the
  unreviewed counter doesn't pollute on hand-typed Excel data.

## Financial reports

- `/trial-balance`, `/income-statement`, `/balance-sheet`, `/wip`
  (existed) + `/cash-flow` (1445) + `/close-package` (1447) —
  print-ready, browser-PDF.
- `/vendor-1099` (existed) + `/vendor-1099/print` printable
  worksheet + CSV export with TaxID + address for CPA filing.

## Workflow polish

- ⌘-K command palette: nav targets + 36 quick-action shortcuts +
  lazy-fetched jobs + estimates as fuzzy-match entries
- `/jobs/board` Kanban pursuit pipeline (5 columns, sorted by
  bid-due proximity)
- Job profitability tile on `/jobs/[id]` (cleared revenue vs.
  cleared cost vs. margin%)
- AR aging snapshot tile on `/dashboard` (4 buckets)
- Photo capture: Supabase Storage helper, `<PhotoUploadWidget>`,
  daily-report inline panel + DR editor link
- Bank-rec match Apply button (extends to AR + expense via the
  `cleared` / `clearedOn` fields added to those schemas)

## What's next

1. ✓ Foundations
2. ✓ AP invoice extract
3. ✓ Bank-rec auto-match
4. ✓ Daily-report narrative
5. ✓ Bid-tab AI extract
6. ✓ Multi-tenant scoping
7. ✓ Photo capture
8. Estimate share-link for subs (read-only public URL) — **pending**
9. Mobile app: Apple Developer + TestFlight + Play Console — **deferred**
10. Payroll Gusto sync — **deferred**

## Things still on the file system (ok to leave)

- `audit-store` row JSON files on Render's `/var/data/audit-events/`
  from before the cutover — backup snapshot. New events go straight
  to Postgres.
- Old estimate JSON files under `/var/data/estimates/` — same story.

Both are inert post-cutover. A later sweep can move them off the
disk into Supabase Storage as cold-storage archives.
