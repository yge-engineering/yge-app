# CLAUDE.md — YGE App

Instructions for Claude Code when working in this repository.

## About this project

YGE App is a bookkeeping + estimating + job management platform for Young General Engineering, Inc. — a heavy-civil contractor in Cottonwood, CA. It replaces Excel + QuickBooks Online. See `README.md` for the full stack and module layout, and `../YGE Project Plan v6.3.docx` in the parent folder for the full scope.

## Who uses it

- **Ryan Young** (VP, primary user) — estimates, approves bids, runs the business.
- **Brook Young** (President) — bonding, insurance, banking, legal.
- **Office staff** — bookkeeping, payroll, document management.
- **Foremen** — daily reports, timecards for their crew, material orders, photos.
- **Field crew** — clock in/out, PTO requests, training certs, employee self-service pay portal.
- **External portal users** — agency owners reviewing progress, subs seeing POs + lien waivers, bond agents seeing capacity.

Design decisions should respect this hierarchy: Ryan and Brook see everything; office sees almost everything; foremen see their crew; crew sees themselves.

## Tech stack

- **Language:** TypeScript (strict mode, `noUncheckedIndexedAccess` on)
- **Web:** Next.js 14 (App Router), React 18, Tailwind CSS, shadcn/ui
- **API:** Node.js 20, Express, tRPC for typed RPC, REST where tRPC doesn't fit
- **Database:** Postgres 16, Prisma ORM
- **Auth:** Supabase Auth (email/password + OAuth Google/Microsoft + WebAuthn for biometric)
- **Storage:** Supabase Storage (docs, photos, PDFs); server-side signed URLs only
- **AI:** `@anthropic-ai/sdk` server-side only; never ship Anthropic key to the browser
- **Monorepo:** pnpm workspaces + Turborepo
- **Mobile (Phase 2):** React Native / Expo, shares `packages/shared` with web + API
- **Hosting:** Vercel (web) + Supabase (db + auth + storage)

## Code conventions

- **No `any`.** Use `unknown` and narrow, or define the type. Strict TS is why we picked it.
- **Shared types live in `packages/shared`.** If web and API both care about it, it belongs there. Do not duplicate shapes.
- **Validation with Zod.** Every API input parsed through a Zod schema. Export the schema AND the inferred type.
- **Prisma is the DB truth.** Don't hand-roll SQL unless it's a performance-critical query, and document why.
- **Money is cents.** Store monetary amounts as `Int` cents, never floats. Converting happens at the edge (form input, display).
- **Dates are `DateTime` in Postgres.** Use ISO-8601 strings on the wire. Never trust client timestamps for anything that matters (timecards, audit logs) — stamp server-side.
- **Files go through the API.** The browser never talks to Supabase Storage directly — always proxy through the API so we can audit, scan, and enforce permissions.
- **Every mutation is audit-logged.** Who, what, when, before-state, after-state. See `packages/shared/src/audit.ts`.

## Working with AI features

- The Anthropic client lives in `apps/api/src/lib/anthropic.ts`. Import from there.
- Prompts live in `apps/api/src/lib/prompts/*.ts`. One file per use case. Version-tag prompts so we can A/B.
- When an AI call writes to the database, wrap it in a human-review step unless the doc explicitly says it can auto-commit. Default is AI drafts, human approves.
- Plans-to-Estimate is the flagship AI feature. It ingests a plan set PDF + specs, produces a first-draft estimate with confidence scores per line. Accuracy grows through the paired training data we collect from each bid.

## Testing

- **Unit tests:** Vitest. Every `packages/shared` export must have a test.
- **Integration tests:** Vitest + Testcontainers Postgres. Test the real DB, not a mock. (Per Ryan: no mocked DB tests.)
- **E2E:** Playwright, runs against a dev Supabase project. Gated on CI.

## Never commit

- `.env`, real credentials, API keys, session secrets
- `seeds/excel-master/*.xlsx` — contains real YGE rate data
- `seeds/dir/*.pdf` — may be fine to commit but check file size first
- `uploads/` — real customer documents

## User instructions that apply to this repo

From Ryan's global `CLAUDE.md`:

1. **Plain English.** Write documentation, error messages, UI copy, commit messages in plain English. No jargon that a heavy-civil contractor wouldn't use. "Estimate" not "proposal record."
2. **Never delete files without approval.** If a file looks obsolete, move it to `~/Desktop/to-be-deleted/` for Ryan to review. Do NOT `rm` without explicit confirmation.
3. **Bid estimate template.** The Standard Bid master template is the reference when generating estimate PDFs.
4. **AI-checker pass on user-facing content.** Any document output (bid PDF, letter, proposal) should read like a human wrote it. Run AI-detection mentally before shipping.

## Company facts (auto-fill source for master profile)

```
Young General Engineering, Inc.
19645 Little Woods Rd, Cottonwood CA 96022

President: Brook L. Young    707-499-7065  brookyoung@youngge.com
VP:        Ryan D. Young     707-599-9921  ryoung@youngge.com

CSLB 1145219 · DIR 2000018967 · DOT 4528204
NAICS 115310 · PSC F003, F004

Domain:    youngge.com (Squarespace)
App host:  app.youngge.com  (CNAME to Vercel, pending go-live)
```

Ryan D. Young is the responsible person on every safety role (IIPP Admin, Emergency Coordinator, Safety Director, etc.) per `../Safety docs/`.

## Phase 1 MVP scope (13–16 weeks)

1. Estimating module — replaces the Excel job cost system.
2. Master rate tables (labor, equipment, equipment rental, materials, subs, cost codes) with CA prevailing wage uplift.
3. Plans-to-Estimate AI — upload plan set or spec, get draft estimate.
4. PDF form filler — pre-mapped agency library (CAL FIRE, Caltrans, DIR, IRS, ACORD, counties) with e-sig inline.
5. Auto form filler browser extension — Safari, Edge, Chrome, Firefox.
6. Master business profile — CSLB, DIR, DOT, bonding, insurance, officers, employee profile v1.
7. Basic auth + multi-tenant company model (YGE only at launch; multi-tenant from day one).

Phases 2–6 expand into daily reports, AP/AR, bookkeeping, QuickBooks replacement, payroll sync with Gusto, CPRs, portals, email intelligence. See the project plan.
