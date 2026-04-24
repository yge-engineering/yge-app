# YGE App

The Young General Engineering bookkeeping and estimating platform.

Replaces Excel + QuickBooks Online with a single connected system: estimates, job cost tracking, daily reports, payroll sync, bookkeeping, document vault, safety, and the AI tooling that ties it all together.

Stack: Next.js 14 (web), React Native / Expo (field mobile, scaffolded in Phase 2), Node.js API, Postgres on Supabase, TypeScript everywhere.

## What's in here

- `apps/web` — Next.js 14 office web app. Desktop-first, handles estimating, bookkeeping, dashboards, document vault, safety.
- `apps/api` — Node/Express API server. Hosts Claude-powered tools (Plans-to-Estimate, AI morning briefing, auto-reconciliation), talks to Postgres through Prisma, and exposes REST + tRPC endpoints for both web and mobile clients.
- `apps/mobile` — React Native / Expo field app for foremen and crew. Phase 2. Phone-first: timecards, daily reports, photos, safety signoffs, equipment inspections.
- `packages/db` — Prisma schema, migrations, and seeded rate tables.
- `packages/shared` — shared TypeScript types and business logic used by web, API, and mobile (validation, rate math, DIR uplift, overtime rules).
- `packages/ui` — shared React components (web).
- `seeds/` — raw seed sources: DIR prevailing wage PDFs, Excel master export.
- `scripts/` — one-off scripts for data extraction, DIR sync jobs, bulk imports.

## Getting started (after clone)

```bash
# 1. Install dependencies
pnpm install

# 2. Start local Postgres (Docker required)
docker compose up -d

# 3. Configure environment
cp .env.example .env
# Edit .env and fill in your Anthropic API key + Supabase credentials

# 4. Initialize database
pnpm db:migrate
pnpm db:seed

# 5. Run everything
pnpm dev
```

Web app opens at http://localhost:3000. API at http://localhost:4000.

## Project plan

The full scope lives in `YGE Project Plan v6.3.docx` (in the parent folder). Phase 1 MVP covers:

1. Estimating (the core of what Excel does today)
2. Plans-to-Estimate AI — upload a plan set or spec, get a first-draft estimate
3. Employee + rate tables with CA prevailing wage uplift
4. PDF form filler with CAL FIRE / Caltrans / DIR / IRS / ACORD pre-mapped
5. Auto form filler browser extension (Safari + Edge + Chrome + Firefox)
6. Master business profile (CSLB, DIR, DOT, bonding, insurance, officers)
7. Basic bookkeeping scaffolding (Phase 2 fills out AR/AP)

## Data model overview

Core entities in the Prisma schema:

- `Company` — YGE initially; built for multi-tenancy from day one.
- `User` — with role: Owner, Office, Foreman, Crew, Employee, External (owner/sub/bond portals).
- `Employee` — wage profile, classifications, certifications, PTO balance.
- `Customer` — agencies (CAL FIRE, Caltrans, counties) and private owners.
- `Job` — one per contract; links to Customer, holds status + rate type (PW / DB / Private / IBEW).
- `Estimate` — per Job; draft, submitted, awarded.
- `BidItem` — per Estimate; breaks an estimate into contract line items.
- `CostLine` — per BidItem; the actual labor/equipment/material/sub/other entries.
- `LaborRate`, `EquipmentRate`, `EquipmentRental`, `Material`, `Subcontractor` — reference rate tables that CostLine points to.
- `CostCode` — cost coding for accounting rollup.
- `DirRateSchedule` — imported CA DIR prevailing wage tables, synced monthly.

Full ERD in `packages/db/prisma/schema.prisma`.

## License

Proprietary. Young General Engineering, Inc.
