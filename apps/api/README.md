# YGE API

Express + TypeScript backend for the YGE app. Houses the AI features
(Plans-to-Estimate, morning briefing, etc.), the REST routes the web app
talks to, and the long-lived background workers (DIR rate sync, document
OCR, etc. as they come online).

## Setup

One-time, on a new machine:

```bash
# From the repo root
pnpm install                   # installs all workspaces

# Make a local .env for the API (other vars can stay empty for the AI dry-run)
cp .env.example apps/api/.env
# edit apps/api/.env and paste your ANTHROPIC_API_KEY
```

The API reads `ANTHROPIC_API_KEY` from `apps/api/.env` via dotenv (pnpm runs
the API scripts with `apps/api` as the working directory, so dotenv looks
there). In production the key comes from the platform's secret store. Never
commit `.env`.

## Run the dev server

```bash
pnpm --filter @yge/api dev
```

That starts Express on http://localhost:4000 with file watching. The web app
on `:3000` calls it via the `NEXT_PUBLIC_API_URL` env var (defaults to the
local URL).

### Health checks

```bash
curl http://localhost:4000/health             # DB ping
curl http://localhost:4000/health/anthropic   # 1-token Anthropic ping
```

`/health/anthropic` confirms the API key is set and reachable without
spending real tokens — use it to debug AI failures before assuming the
prompt is broken.

## Run the tests

```bash
pnpm --filter @yge/api test           # vitest, no network calls
pnpm --filter @yge/api typecheck      # strict TS
```

Tests use a fake Anthropic client — they never hit the real API.

## Plans-to-Estimate dry run

The dry-run CLI lets you point at a text file and get a draft estimate back
without running the dev server or web app. Useful for testing prompt changes
or running the AI on a real bid before the full UI is wired up.

```bash
# From the repo root
pnpm --filter @yge/api dry-run:ptoe -- seeds/sample-rfp/cottonwood-creek-drainage.txt
```

The `--` is required by pnpm to forward arguments to the script.

What you'll see:

```
Reading /Users/.../cottonwood-creek-drainage.txt
Extracted 2,431 characters of text.
Calling Anthropic — this typically takes 30-90 seconds...
Done in 41.2s. Model: claude-sonnet-4-6. Prompt: plans-to-estimate@1.0.0.
Tokens: in=1,234, out=567

Project:    Cottonwood Creek Drainage Improvements
Confidence: HIGH
Bid items:  13

Full draft saved to: /Users/.../cottonwood-creek-drainage.draft-estimate.json
```

The full draft (with quantities, units, confidence per line, assumptions,
and open questions) lands in the JSON file printed at the end.

### Pointing at a real RFP

Plain-text input only for now. To run on a real PDF:

1. Open the PDF in Bluebeam or Adobe Acrobat.
2. File → Export → Text (Bluebeam) or File → Export To → Text (Acrobat).
3. Save the `.txt` somewhere convenient.
4. Pass the path to the dry-run command above.

`pdftotext` (from the `poppler` Homebrew package) also works:

```bash
brew install poppler
pdftotext "Sulphur Springs RFP.pdf" sulphur-springs.txt
pnpm --filter @yge/api dry-run:ptoe -- sulphur-springs.txt
```

Native PDF + OCR ingestion lands in Phase 1 weeks 4-8 — for now, you do the
PDF→text conversion in the tool that knows the document best.

### Optional: pass session notes

If you want the AI to know about a mandatory site walk, an estimator's
hunch, or other context that isn't in the document itself:

```bash
pnpm --filter @yge/api dry-run:ptoe -- doc.txt --notes "Mandatory site walk Tue 4/28; CAL FIRE PW; haul self-performed"
```

Notes get tagged as priority context in the prompt.

## Saved drafts (history)

Every successful Plans-to-Estimate run is auto-saved to `apps/api/data/drafts/`
as a JSON file named by date + project slug + random suffix
(e.g. `2026-04-24-cottonwood-creek-drainage-a1b2c3d4.json`). A small
`index.json` in the same folder tracks the summary list for the `/drafts`
page.

The data folder is gitignored — saved drafts can include the full RFP text
the user pasted, which may be pre-public bid material. Postgres replaces this
file store later in Phase 1 once the Estimate / BidItem schema lands; the
public surface (`saveDraft`, `listDrafts`, `getDraft`) maps 1:1 to a Prisma
repository so the route + UI don't change.

API endpoints:

- `POST /api/plans-to-estimate` — generate + save a draft. Returns
  `savedId` you can use to deep-link to `/drafts/<savedId>`.
- `GET /api/plans-to-estimate/drafts` — newest-first summary list.
- `GET /api/plans-to-estimate/drafts/:id` — full saved draft including the
  original document text.
- `GET /api/plans-to-estimate/drafts/:id/export.csv` — bid items as a
  direct CSV download (same bytes as the in-page Download CSV button).

Web pages:

- `/drafts` — list every saved run with project name, type, item count,
  confidence, and timestamp.
- `/drafts/:id` — full draft view with CSV export, plus the original
  document text in a collapsed section so you can re-run later.

## Priced estimates

A draft is what the AI thinks the bid items are. A priced estimate is what
that draft becomes once a human starts attaching unit prices. Click
**Convert to priced estimate** on any saved draft to clone it into an
editable estimate; then walk down the bid items typing dollar prices.

Storage mirrors drafts: each estimate is a JSON file under
`apps/api/data/estimates/` with a small `index.json` for the list view.
Same Phase 1 stand-in pattern, same gitignore rule.

API endpoints (mounted at `/api/priced-estimates`):

- `POST /api/priced-estimates/from-draft` — body `{ fromDraftId, oppPercent? }`.
  Clones the draft's bid items into a new estimate with all unit prices
  null. Returns the new estimate (use `estimate.id` to redirect).
- `GET /api/priced-estimates` — newest-first summary list.
- `GET /api/priced-estimates/:id` — full estimate plus computed totals
  (`directCents`, `oppCents`, `bidTotalCents`, `unpricedLineCount`).
- `PATCH /api/priced-estimates/:id` — update `oppPercent`, `notes`, or
  the full `bidItems` array. Returns the updated estimate + fresh totals.
- `PATCH /api/priced-estimates/:id/items/:itemIndex` — body
  `{ unitPriceCents }`. Used by the inline editor so each keystroke flush
  doesn't re-send the whole bid list.
- `PUT /api/priced-estimates/:id/sub-bids` — body `{ subBids: SubBid[] }`.
  Replaces the full subcontractor list. PUT (not PATCH) because we replace
  the whole array atomically. The §4104 classification (must-list vs.
  borderline vs. optional) is computed on read by the UI from
  `classifySubBids` in `@yge/shared`.
- `GET /api/priced-estimates/:id/export.csv` — full priced estimate as a
  direct CSV download. Includes a totals block at the bottom (direct cost,
  O&P, bid total) so the recipient doesn't need to add a SUM formula.

Web pages:

- `/estimates` — list view with running bid totals + unpriced-line counts.
- `/estimates/:id` — full inline editor: dollar input per line, O&P
  percent input at the bottom, totals card live-updates from the server.
- `/estimates/:id/print` — print-ready bid summary on YGE letterhead
  with company info, bid item schedule, totals block, designated
  subcontractor list (PCC §4104), and signature line. Hit *Print / Save
  as PDF* in the page header to drop straight into a PDF for the bid
  package. Logo block is a placeholder until the brand kit lands.

The estimate editor (`/estimates/:id`) also exposes a **Subcontractor
list** section. Each row is a sub the prime intends to use; the UI tags
each row as **Must list / Borderline / Optional** based on CA Public
Contract Code §4104 (subs over the threshold dollar amount must appear
on the bid form, or the bid is non-responsive). Threshold is `max(0.5%
of bid total, $10,000)` for streets/highways/bridges and `0.5%` for
other public works.

The math (`computeEstimateTotals`, `lineExtendedCents`) lives in
`@yge/shared/priced-estimate.ts` so the API and the UI never disagree on
what the running total is. Money stays in cents end-to-end.

When the Estimate / BidItem schema lands in Postgres later in Phase 1, the
file-backed store goes away and `/api/estimates` (the existing Prisma
router) absorbs this surface; the routes + UI don't change.

## Project conventions

- Validation with Zod on every input. See `routes/plans-to-estimate.ts`.
- Money in cents, never floats.
- AI calls go through `services/*.ts`; never call Anthropic directly from
  a route handler.
- Prompts live in `lib/prompts/<feature>-vN.ts`. Bump `N` and the
  `PROMPT_VERSION` constant when the prompt changes meaningfully.
- All AI services accept an injectable client for testability.
- File-backed stores (e.g. `lib/drafts-store.ts`) live behind a function
  surface that maps cleanly to Prisma so the swap is mechanical.
