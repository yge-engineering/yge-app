# Phase 2 plan

**Phase 1 status:** shipped 2026-05-06. App live at app.youngge.com,
API at api.youngge.com, 68-table Postgres backing it, 15 PDF agency
forms seeded, browser extension built. See `docs/PHASE_1_STATUS.md`.

**Phase 2 goal:** turn YGE App from "an estimating tool" into "the
back office."

## Seven themes

Each theme has web pages already scaffolded — they mostly need
better data, AI assistance, or Postgres migration to be production-grade.

### 1. Storage + foundations *(autopilot-friendly, prerequisite for everything else)*
- Migrate the remaining ~50 file-stores to Postgres (template trodden in bundles 1347–1357)
- Supabase Storage wired through the API for photos + document uploads
- Multi-tenant scoping: `companyId` from auth context, not the hardcoded `yge-root`
- Sentry + structured logging in production

### 2. AI bookkeeping *(highest user-value)*
The Anthropic key is already wired (Phase 1 P2E + the title-block / scope-gap / spec-extras / bid-schedule prompts prove the pipeline works). Phase 2 extends to bookkeeping:

- **AP invoice extract** — drop a vendor PDF into `/ap-invoices/new`, Claude reads it, pre-fills vendor / invoice # / amount / due date / line items + GL coding, human approves. Saves ~5 min per invoice.
- **Bank reconciliation auto-match** — Claude matches each bank transaction to an existing AR payment, AP payment, expense, or unmatched bucket. Saves ~30 min per monthly recon.
- **Email-to-action triage** — incoming `payments@youngge.com` / `ap@youngge.com` mail gets auto-categorized: "this is a paid invoice from Caltrans, here's the AR invoice it pays" / "this is a vendor bill, draft an AP invoice." Plain-English summary in /dashboard's Inbox tile.
- **Daily report narrative** — foreman dictates 3 bullet points; Claude expands into the prose section.
- **Bid tab cross-check** — Claude reads a Caltrans bid tab PDF, extracts every bidder + total, flags YGE's rank + delta to winner, drafts the entry on /bid-tabs.

### 3. Foreman + crew mobile flows
- Daily report draft with photo capture (Supabase Storage upload from RN)
- Time card with crew assignment (foreman fills for the whole crew, not just self)
- Dispatch board (drag job → crew member, push notification triggers)
- PTO request + approval round-trip

The mobile app shipped as scaffold in Phase 1 — these features are the actual day-to-day workflow.

### 4. Bookkeeping completion
- AP cycle: invoice → approval → payment → check/ACH/bill-pay → 1099 close-out
- AR cycle: invoice → email/mail → payment → deposit → reconciliation
- General ledger + journal entries + chart of accounts (already pages, need Postgres + GL math)
- Financial reports: trial balance, balance sheet, P&L, cash flow forecast, WIP, retention
- All of these have web pages already; need data plumbing

### 5. Payroll
- Gusto integration (read employees, push hours, pull paychecks back)
- Certified Payroll Reports (CPRs) — DIR A-1-131 form generation from time cards
- Apprentice ratio tracking (pairs with the DAS-140/141/142 forms already seeded)
- Prevailing wage + fringe benefits validation

### 6. Portals
- **Owner portal** (agency primes): see project status, change orders, RFIs, photos
- **Sub portal**: see POs, lien waivers needed, bid invites
- **Bond agent portal**: see capacity used / available, current jobs, financial summary
- These exist as user roles in the schema (`EXTERNAL_OWNER`, `EXTERNAL_SUB`, `EXTERNAL_BOND`); the read-only views need to be built

### 7. Email intelligence
- Microsoft Graph API integration (already partial — see `apps/api/src/routes/microsoft.ts` + the SSO already wired)
- Inbox triage: classify incoming emails into bid invitations, RFIs, lien waiver requests, vendor bills, customer payments, agency notices
- Suggest responses + auto-file by job

## Order autopilot will work in

1. **Foundations first** (themes 1) — finish the Postgres migration, wire Supabase Storage, tighten tenant scoping. Sets us up for everything else.
2. **AP invoice AI extract** (theme 2.1) — single self-contained AI feature, big day-to-day win, demonstrates Phase 2 = AI-powered automation.
3. **Bank rec auto-match** (theme 2.2) — second AI feature, builds on foundations, saves Ryan ~30 min/mo.
4. **Daily report photos + narrative** (themes 2.4 + 3.1) — unlocks foreman mobile flow.
5. **Bookkeeping completion** (theme 4) — fill out the financial-report screens with real data.
6. **Payroll Gusto sync** (theme 5) — bigger lift, defer until 1–4 are solid.
7. **Portals + email intelligence** (themes 6, 7) — round out the user model.

## What's not in Phase 2

- The Excel-master complete ingest (manual data entry until the auto-import is reliable)
- Multi-company / external customer tenancy (architecture supports it, but YGE is the only tenant)
- Native mobile features beyond what RN gives us out of the box (offline-first sync, background notifications)

## Definition of done

Phase 2 is "done" when Brook can run a complete monthly close in YGE App without opening QuickBooks Online or Excel: AR invoices sent, AP invoices paid, bank reconciled, journal entries posted, P&L + balance sheet generated, certified payrolls filed.

That's a quarter or two of work — a handful of bundles per day will get there.
