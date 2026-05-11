# Phase 4 plan

**Phases 1-3 status:** see `PHASE_1_STATUS.md`, `PHASE_2_STATUS.md`,
`PHASE_3_STATUS.md`. Estimating, master tables, AI features,
financial reports, portals, compliance forms, observability — all
live at app.youngge.com / api.youngge.com.

**Phase 4 goal:** finish the QuickBooks replacement. Definition of
done: Brook runs the monthly close start-to-finish in YGE App —
imports the bank statement, reconciles, posts journal entries,
generates financial statements, files CPRs, closes the period —
without opening QBO or Excel.

## Six themes

### 1. Bank statement import (highest accountant-pain item)
- Upload OFX / QFX / QBO bank-statement file (every bank exports
  these for free)
- Parse into pending bank-statement rows
- Auto-match against ApPayment / ArPayment / Expense (the bank-rec
  match panel already does this against pasted CSV — extend to
  parse the standardized file format)
- Bulk-clear matched rows
- Surface unmatched as suggestions for new expense / journal entry
  drafts

### 2. AP cycle: receive → approve → pay → close
- Email-to-AP-draft from the bundle 1439 inbox-triage results
  (currently we tag VENDOR_BILL; this turns the email into a
  draft ApInvoice with attached PDF + extract via the bundle 1383
  Storage helper)
- Approval workflow (already exists, polish multi-approver)
- Pay batch — select multiple approved invoices, generate ACH file
  or printable check register
- 1099 close-out (printable worksheet shipped in Phase 2; auto-
  generate at year-end)

### 3. AR cycle: invoice → send → collect → reconcile
- Generate AR invoice PDF + email send via Microsoft Graph
- Aged-AR collection reminders (auto-send 30/60/90-day notices)
- Customer statement generation
- Cash deposit batching that posts to bank-rec automatically

### 4. Forecasting + close
- 90-day cash forecast (extends the existing cash-flow page into
  forward-looking projections from open AP + open AR + payroll
  estimates)
- WIP / cost-to-complete on each active job
- Period close-out wizard: lock the period, run the trial-balance
  check, post automatic accruals, archive
- Year-end close: post tax accruals, generate 1099s, reset retained
  earnings

### 5. Field operations polish
- Dispatch board (drag-drop equipment + crew onto jobs by day)
- Time-card auto-build from clock-in/out (already partially
  shipped; need the weekly-roll-up to feed CPR generation)
- Foreman daily-report nudge (text the foreman if no DR by 7pm)

### 6. Email intelligence v2 (build on Phase 2 inbox-triage)
- Auto-draft the obvious downstream actions:
  - VENDOR_BILL email → AP invoice draft + the AP-invoice extract
    AI run + Storage upload (already wired)
  - CUSTOMER_PAYMENT email → AR payment draft + bank-rec hint
  - RFI email → RFI draft on the matching job
  - BID_INVITATION email → Job draft with bid-due date + agency name
- Inbox digest summary (one email per morning with the AI's
  categorized + suggested-action breakdown)

## Order of attack

1. **Bank statement OFX/QFX import** — saves Brook ~3h / month and
   feeds every other bookkeeping flow
2. **AP draft from email triage** — extends Phase 2 work, biggest
   per-invoice time win
3. **Aged-AR collection automation** — saves the office time + gets
   YGE paid faster
4. **90-day cash forecast** — Ryan + Brook see the runway
5. **Field-ops dispatch polish** — once the office side is solid
6. **Year-end close-out wizard** — Q4 calendar item

## What's not in Phase 4

- Custom report builder — handle through the existing TB / IS /
  BS / WIP / CF pages
- Multi-currency — YGE works in USD only
- Inventory management beyond the existing Material movement
  ledger — handle in a separate phase if Brook actually wants it

## Definition of done

Phase 4 is done when Brook closes a month entirely inside YGE App:
- All bank statements imported + reconciled (no Excel)
- All AP invoices approved + paid + cleared
- All AR invoices sent + payments matched + cleared
- Period locked + journal entries posted
- TB + IS + BS + Cash-flow generated + handed to the CPA
- No QuickBooks Online tab opened the entire month
