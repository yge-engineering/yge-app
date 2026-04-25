// File-based store for priced estimates.
//
// An estimate is what a Plans-to-Estimate draft becomes once a human starts
// filling in unit prices. Phase 1 stand-in for the future Estimate /
// BidItem Postgres tables. Surface area maps 1:1 to a Prisma repository so
// the route + UI don't change when Postgres lands.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';
import {
  PricedEstimateSchema,
  blankPricedItemsFromDraft,
  type Addendum,
  type BidSecurity,
  type PricedEstimate,
  type PricedBidItem,
  type PtoEOutput,
  type SubBid,
} from '@yge/shared';

// Resolve the data dir lazily on every call so tests can override it via
// ESTIMATES_DATA_DIR after the module has loaded.
function dataDir(): string {
  return (
    process.env.ESTIMATES_DATA_DIR ??
    path.resolve(process.cwd(), 'data', 'estimates')
  );
}
function indexPath(): string {
  return path.join(dataDir(), 'index.json');
}

export interface EstimateSummary {
  id: string;
  fromDraftId: string;
  jobId: string;
  createdAt: string;
  updatedAt: string;
  projectName: string;
  projectType: string;
  ownerAgency?: string;
  bidDueDate?: string;
  bidItemCount: number;
  pricedLineCount: number;
  unpricedLineCount: number;
  oppPercent: number;
  /** Pre-computed once on save so the index page doesn't have to load every
   *  full estimate. Refreshed on every `updateEstimate` call. */
  bidTotalCents: number;
  /** Number of subcontractors captured for this estimate. The list view
   *  uses this to show "0 subs" / "5 subs" without loading the full file. */
  subBidCount: number;
  /** Number of addenda logged. */
  addendumCount: number;
  /** How many addenda are logged but un-acknowledged. The list view shows
   *  this in red so an estimate that's about to fail at bid open is
   *  visible without opening it. */
  unacknowledgedAddendumCount: number;
}

export interface CreateFromDraftInput {
  fromDraftId: string;
  jobId: string;
  draft: PtoEOutput;
  /** Default O&P. Caller can override; the editor lets the user adjust it. */
  oppPercent?: number;
}

async function ensureDir() {
  await fs.mkdir(dataDir(), { recursive: true });
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function makeId(projectName: string, when: Date): string {
  const date = when.toISOString().slice(0, 10);
  const slug = slugify(projectName) || 'estimate';
  const rand = randomBytes(4).toString('hex'); // 8 hex chars
  return `est-${date}-${slug}-${rand}`;
}

function summarize(est: PricedEstimate): EstimateSummary {
  let priced = 0;
  let unpriced = 0;
  let directCents = 0;
  for (const item of est.bidItems) {
    if (item.unitPriceCents == null) {
      unpriced += 1;
    } else {
      priced += 1;
      directCents += Math.round(item.quantity * item.unitPriceCents);
    }
  }
  const oppCents = Math.round(directCents * est.oppPercent);
  return {
    id: est.id,
    fromDraftId: est.fromDraftId,
    jobId: est.jobId,
    createdAt: est.createdAt,
    updatedAt: est.updatedAt,
    projectName: est.projectName,
    projectType: est.projectType,
    ownerAgency: est.ownerAgency,
    bidDueDate: est.bidDueDate,
    bidItemCount: est.bidItems.length,
    pricedLineCount: priced,
    unpricedLineCount: unpriced,
    oppPercent: est.oppPercent,
    bidTotalCents: directCents + oppCents,
    subBidCount: est.subBids?.length ?? 0,
    addendumCount: est.addenda?.length ?? 0,
    unacknowledgedAddendumCount:
      est.addenda?.filter((a) => !a.acknowledged).length ?? 0,
  };
}

async function readIndex(): Promise<EstimateSummary[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as EstimateSummary[]) : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: EstimateSummary[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

function estimatePath(id: string): string {
  return path.join(dataDir(), `${id}.json`);
}

/**
 * Build a fresh PricedEstimate from a saved draft and persist it. Returns the
 * full saved record so the caller can render or redirect.
 */
export async function createFromDraft(
  input: CreateFromDraftInput,
): Promise<PricedEstimate> {
  await ensureDir();
  const now = new Date();
  const id = makeId(input.draft.projectName, now);
  const iso = now.toISOString();
  const est: PricedEstimate = {
    id,
    fromDraftId: input.fromDraftId,
    jobId: input.jobId,
    createdAt: iso,
    updatedAt: iso,
    projectName: input.draft.projectName,
    projectType: input.draft.projectType,
    location: input.draft.location,
    ownerAgency: input.draft.ownerAgency,
    bidDueDate: input.draft.bidDueDate,
    bidItems: blankPricedItemsFromDraft(input.draft.bidItems),
    oppPercent: input.oppPercent ?? 0.2,
    subBids: [],
    addenda: [],
  };
  // Validate before writing so a buggy caller can't poison the store.
  PricedEstimateSchema.parse(est);
  await fs.writeFile(estimatePath(id), JSON.stringify(est, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(summarize(est));
  await writeIndex(index);
  return est;
}

export async function listEstimates(): Promise<EstimateSummary[]> {
  return readIndex();
}

export async function getEstimate(id: string): Promise<PricedEstimate | null> {
  // Defensive: only allow ids that match our format. Stops path traversal cold.
  if (!/^est-[a-z0-9-]{10,80}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(estimatePath(id), 'utf8');
    // Run through the schema so newly added optional fields with defaults
    // (e.g. subBids: []) backfill cleanly when reading older files.
    return PricedEstimateSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

/** Patch fields you can change at the estimate level. Bumps `updatedAt`. */
export interface EstimatePatch {
  oppPercent?: number;
  notes?: string;
  bidItems?: PricedBidItem[];
  /** Replace the full subcontractor list. The editor PATCHes the whole
   *  array because individual sub edits are rare and bundling avoids the
   *  edit-in-the-middle race that per-id PATCHes would invite. */
  subBids?: SubBid[];
  /** Replace the bid security record. Pass `null` to clear it (not every
   *  bid needs security; some private/task-order work skips it). */
  bidSecurity?: BidSecurity | null;
  /** Replace the full addendum list. Same atomic-replace logic as the
   *  sub list — addenda are typically small (0-10) and the editor saves
   *  every commit through this single field. */
  addenda?: Addendum[];
}

export async function updateEstimate(
  id: string,
  patch: EstimatePatch,
): Promise<PricedEstimate | null> {
  const existing = await getEstimate(id);
  if (!existing) return null;

  const updated: PricedEstimate = {
    ...existing,
    ...(patch.oppPercent != null ? { oppPercent: patch.oppPercent } : {}),
    ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
    ...(patch.bidItems ? { bidItems: patch.bidItems } : {}),
    ...(patch.subBids ? { subBids: patch.subBids } : {}),
    ...(patch.bidSecurity !== undefined
      ? { bidSecurity: patch.bidSecurity ?? undefined }
      : {}),
    ...(patch.addenda ? { addenda: patch.addenda } : {}),
    updatedAt: new Date().toISOString(),
  };
  PricedEstimateSchema.parse(updated);
  await fs.writeFile(estimatePath(id), JSON.stringify(updated, null, 2), 'utf8');

  // Rebuild the summary entry in the index — totals may have moved.
  const index = await readIndex();
  const idx = index.findIndex((e) => e.id === id);
  if (idx >= 0) {
    index[idx] = summarize(updated);
  } else {
    index.unshift(summarize(updated));
  }
  await writeIndex(index);
  return updated;
}

/**
 * Update a single line's unit price. Convenience for the editor's per-row
 * save pattern (faster than re-sending the whole bidItems array).
 */
export async function setLineUnitPrice(
  id: string,
  itemIndex: number,
  unitPriceCents: number | null,
): Promise<PricedEstimate | null> {
  const existing = await getEstimate(id);
  if (!existing) return null;
  if (itemIndex < 0 || itemIndex >= existing.bidItems.length) return null;
  const items = existing.bidItems.slice();
  // We've already bounds-checked itemIndex above, so items[itemIndex]
  // is provably defined — but TS can't prove it through .slice(), so
  // narrow with a non-null assertion.
  items[itemIndex] = { ...items[itemIndex]!, unitPriceCents };
  return updateEstimate(id, { bidItems: items });
}
