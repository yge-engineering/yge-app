# Phase 2 status — 2026-05-07

## Migration sweep — DONE

All 58 server-side stores are Postgres-backed. None still import
`node:fs/promises`. The full `apps/api/src/lib/*-store.ts` suite
went from "files on a Render persistent disk" to "rows in Supabase
Postgres" without a route or UI change.

### Schema additions (auto-applied via Render `prisma migrate deploy`)
- `data Json?` on Customer / Employee / Job / CostCode / LaborRate /
  EquipmentRate / Material / Estimate (mirrors the full Zod shape so
  no field-by-field column mapping was needed)
- `reason String?` on AuditEvent
- New `Equipment` model + `equipment_assets` table for asset tracking
- New `DirRateProposal` model + `dir_rate_proposals` table
- `Job.customerId` made nullable (file-store rows have no customer
  link yet — UI follow-up)

### Operational changes
- `render.yaml` runs `prisma migrate deploy` on every build (1405).
- New migrations land automatically on next deploy.

## Multi-tenant scoping — WIRED

Every Postgres-backed store now resolves its tenant `companyId`
from the active request context, falling back to the
`DEFAULT_COMPANY_ID` env var only when there's no request (CLI,
background jobs, tests).

- `apps/api/src/lib/request-context.ts` — Node AsyncLocalStorage
  carrying `companyId` / `actorUserId` / `ipAddress` / `userAgent`
- `apps/api/src/middleware/tenant.ts` — Express middleware seeds
  the context from the `X-YGE-Company` header (or env default)
  before any router fires
- `recordAudit()` reads from the request context as a fallback so
  audit rows are correctly tagged with the right tenant + actor
  even when the calling route forgets to pass an explicit
  `AuditContext` (1422)
- All 53 tenant-scoped stores read `getRequestCompanyId() ??
  FALLBACK_COMPANY_ID` (1429-1432). The `microsoft-tokens` and
  `sso-handoff` stores are keyed by email/token so they don't need
  a tenant scope.

The header read in `tenantMiddleware` is the temporary plumbing —
real Phase 2 multi-tenant ties it to a session-cookie auth lookup
(user → user.companyId). The store-side consumer is permanent.

## AI features

### Already in production
- **Plans-to-Estimate** — PDF plan set → draft estimate (Phase 1)
- **AP-invoice extract** — vendor PDF → pre-filled invoice (Phase 1)
- **Title-block / scope-gap / spec-extras / bid-schedule** prompts
  on the estimate review pane (Phase 1)
- **Cross-check addenda** between RFP + bid response (Phase 1)

### Newly shipped (Phase 2 sweep, 2026-05-07)
- **Bank-rec auto-match** (1370, 1414-1416) — bookkeeper pastes
  unmatched statement rows, AI suggests AR / AP / expense matches
  with HIGH/MEDIUM/LOW confidence + reasoning. Read-only review
  pane on `/bank-recs/[id]`.
- **Daily-report narrative expansion** (1417, 1419-1420) — foreman
  types 3 bullets, "Expand to prose (AI)" button returns a 2-4
  sentence paragraph. Foreman edits before saving.
- **Bid-tab PDF extract** (1423-1424) — drop a Caltrans / county /
  agency bid-tab PDF on `/bid-tabs/new`, AI returns structured
  agency / project / bid-open / bidder list. Operator reviews +
  saves through the existing import form.

## Storage

- **Supabase Storage helper** (1383) — server-side wrapper around
  the REST API. Buckets: `yge-photos`, `yge-docs`, `yge-extracts`.
- **Photo upload endpoint** (1426) — `POST /api/photos/upload` takes
  a multipart image, pushes to `yge-photos`, returns the storage
  key + a 10-minute signed URL.
- **Photo upload widget** (1427) — `<PhotoUploadWidget>` on the
  photo editor handles file pick / mobile camera capture, stuffs
  the resulting object key into the `reference` field.

## What's next

1. **Foundations** ✓ DONE
2. **AP invoice AI extract** ✓ DONE
3. **Bank-rec auto-match** ✓ DONE
4. **Daily-report narrative** ✓ DONE
5. **Bid-tab AI extract** ✓ DONE
6. **Multi-tenant scoping** ✓ DONE (foundation + all 53 stores wired)
7. **Photo capture for daily reports** ✓ DONE (uploadwidget shipped;
   wiring it into the daily-report editor is a follow-up)
8. **Bank-rec match Apply button** — turn the read-only review panel
   into one-click match application (set ApPayment.cleared, etc.)
9. **Bookkeeping completion** — financial reports (P&L, balance
   sheet, WIP, cash flow) need GL math + UI; some pages already
   exist but need data plumbing
10. **Payroll Gusto sync** — deferred
11. **Portals + email intelligence** — deferred

## Things still on the file system (ok to leave)

- `audit-store` row JSON files on Render's `/var/data/audit-events/`
  from before the cutover — kept as a backup snapshot. Newly-
  recorded events go straight to Postgres.
- Old estimate JSON files under `/var/data/estimates/` — same story.

Both are inert post-cutover. A later sweep can move them off the
disk into Supabase Storage as cold-storage archives.
