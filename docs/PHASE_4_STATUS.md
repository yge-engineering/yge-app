# Phase 4 status — 2026-05-10 (kickoff)

Phase 4 kicked off late tonight after Phase 3 closed at 41
bundles. First batch of bundles (1519-1526) covers theme 1 (bank
statement import) + dashboard close-progress tile + the AP
check-run worksheet.

## Foundation — DONE
- Phase 4 plan doc with 6 themes ranked by leverage (1519)

## Bank statement import — DONE
- **OFX/QFX parser** in `@yge/shared/ofx-parser` — regex-based, no
  new deps. Extracts `<STMTTRN>` blocks → array of {date,
  description, amountCents, fitId, trnType}. Handles both SGML and
  XML OFX variants (1520)
- **`POST /api/bank-recs/:id/import-ofx`** endpoint — accepts a
  multipart .ofx/.qfx file, returns parsed transactions + statement
  period + ledger balance (1521-22)
- **OFX upload row** on the BankRecMatchPanel — banker downloads
  OFX, drops it on the panel, parsed rows auto-fill the CSV
  textarea. Then run the existing AI match panel. (1521-22)

## Close-out — DONE
- **Close progress tile** on `/dashboard` — pulls from
  `buildCloseChecklist`, shows month-end blockers passing/total +
  progress bar + a list of the first 5 failing blockers with deep
  links (1523-24)

## AP cycle — DONE (worksheet phase)
- **`/ap-check-run`** page — approved + unpaid invoices grouped by
  vendor, sorted by urgency (overdue / due soon). Shows total cash
  needed for the run. Nav link added under Financials. The actual
  paying-from-bank step stays in `/ap-invoices/[id]` so the audit
  trail per-invoice stays clean (1525-26)

## Not yet started (in Phase 4 plan order)
- **AP draft from VENDOR_BILL emails** — extends Phase 2 inbox-
  triage by auto-creating an ApInvoice draft from each tagged
  vendor-bill email (requires Graph email-fetch + AP-invoice
  extract chain)
- **Aged-AR collection reminders** — auto-email 30/60/90-day
  notices
- **90-day cash forecast** — already shipped as `/cash-forecast`
  in Phase 2; revisit if Brook needs more depth
- **Field dispatch board drag-drop**
- **Year-end close-out wizard**

## What Ryan + Brook can do now

After Render + Vercel auto-deploy the latest commit:

1. On any `/bank-recs/[id]`, click "Or import OFX/QFX" → drop the
   bank's OFX file → parsed rows auto-fill the AI match panel
   below → click "Match with AI" → review + "Apply HIGH matches".
2. On `/dashboard`, the close-progress tile shows month-end
   readiness with the first 5 failing blockers + deep links.
3. On `/ap-check-run`, see who's owed money, ranked by urgency,
   grouped by vendor, with a total-cash-needed figure.

## Phase 4 round-up

8 bundles in the kickoff hour. The bank-statement-OFX import is
the biggest leverage item — saves Brook ~30 min/month and feeds
every other bookkeeping flow downstream (AP clear, bank rec,
period close).

Pending themes for tomorrow + later sittings:
- Email-triage AP draft chain
- AR collection automation
- Dispatch board polish
- Year-end close wizard
