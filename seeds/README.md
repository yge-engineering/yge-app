# Seeds

Raw data sources that feed the YGE master rate tables and compliance references.

## `dir/`

CA Department of Industrial Relations prevailing wage PDFs. Downloaded per classification + area + effective date. Parsed into `DirRateSchedule` records by `scripts/import-dir.ts` (Phase 1).

- `laborer-area-2-2026-jan.pdf` — example filename convention
- `operator-group-4-area-1-2026-jan.pdf`

Never hand-edit these — always replace from the official DIR portal at
https://www.dir.ca.gov/OPRL/PWD/

## `excel-master/`

Export of YGE's current Excel job cost system master tables. Populates labor rates, equipment rates, equipment rentals, materials, subcontractors, cost codes, and employee list on first boot.

- `yge-master-export.xlsx` — produced by `scripts/export-excel-master.py`

Not committed to git (contains real rate data). Ryan and Brook place a fresh export here when rates change.

## Loading

```bash
# First-time import
pnpm db:seed

# Re-import just the DIR tables (after new PDFs land)
pnpm tsx scripts/import-dir.ts

# Re-import the Excel master
pnpm tsx scripts/import-excel-master.ts
```
