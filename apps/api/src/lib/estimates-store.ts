// Every mutation here records an audit event via recordAudit() —
// CLAUDE.md mandates 'every mutation is audit-logged'.
//
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
  newSubBidId,
  type Addendum,
  type BidSecurity,
  type PricedEstimate,
  type PricedBidItem,
  type PtoEOutput,
  type SubBid,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

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
  ctx?: AuditContext,
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
    subLeveling: [],
  };
  // Validate before writing so a buggy caller can't poison the store.
  PricedEstimateSchema.parse(est);
  await fs.writeFile(estimatePath(id), JSON.stringify(est, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(summarize(est));
  await writeIndex(index);
  await recordAudit({
    action: 'create',
    entityType: 'Estimate',
    entityId: id,
    after: est,
    ctx,
  });
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
  /** Replace the full sub-leveling worksheet. */
  subLeveling?: PricedEstimate['subLeveling'];
  /** Replace the markup-stack percentages (labor burden, equipment
   *  burden, sub markup, bonds, insurance, contingency). */
  markup?: PricedEstimate['markup'];
}

export async function updateEstimate(
  id: string,
  patch: EstimatePatch,
  ctx?: AuditContext,
  /** Override when the patch is a domain action ('sign' the bid
   *  acceptance, 'submit' the bid, 'archive' a stale draft) rather
   *  than a generic field edit. */
  auditAction: 'update' | 'submit' | 'sign' | 'archive' = 'update',
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
    ...(patch.subLeveling ? { subLeveling: patch.subLeveling } : {}),
    ...(patch.markup ? { markup: patch.markup } : {}),
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
  await recordAudit({
    action: auditAction,
    entityType: 'Estimate',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}

/**
 * Result of promoting a sub-leveling worksheet's awarded bid into the
 * §4104 sub list. Discriminated so the route can map cleanly to HTTP
 * status codes (404 for missing estimate/scope, 400 for empty data the
 * estimator still needs to fill in).
 */
export type PromoteAwardedResult =
  | { ok: true; estimate: PricedEstimate; subBidId: string }
  | { ok: false; status: 400 | 404; reason: string };

/**
 * Build a §4104 SubBid from a sub-leveling scope's awarded competing
 * quote and append it to the estimate's `subBids` array.
 *
 * Plain English: the estimator typed competing quotes into the leveling
 * worksheet, picked a winner, and now wants that winner to show up on
 * the bid envelope's §4104 list without retyping. This helper does that
 * promotion atomically and audit-logs it as a normal estimate update.
 *
 * Idempotency: this always appends a new SubBid (new id). If the user
 * clicks the button twice, two rows show up — they can delete one in
 * the §4104 editor. We chose this over a "skip if duplicate exists"
 * rule because the matching keys (contractor + portion of work) can
 * legitimately repeat (e.g. a prime that bids two scopes), so silent
 * dedupe would be wrong.
 */
export async function promoteAwardedToSubList(
  id: string,
  scopeId: string,
  ctx?: AuditContext,
): Promise<PromoteAwardedResult> {
  const existing = await getEstimate(id);
  if (!existing) return { ok: false, status: 404, reason: 'Estimate not found' };

  const scope = existing.subLeveling.find((s) => s.id === scopeId);
  if (!scope) return { ok: false, status: 404, reason: 'Scope not found' };
  if (!scope.awardedBidId) {
    return { ok: false, status: 400, reason: 'No awarded bid in this scope' };
  }
  const awarded = scope.bids.find((b) => b.id === scope.awardedBidId);
  if (!awarded) {
    return { ok: false, status: 400, reason: 'Awarded bid not found in scope' };
  }
  const contractorName = awarded.contractorName.trim();
  if (!contractorName) {
    return {
      ok: false,
      status: 400,
      reason: 'Awarded contractor name is empty — fill it in before sending',
    };
  }
  const portionOfWork = scope.scope.trim();
  if (!portionOfWork) {
    return {
      ok: false,
      status: 400,
      reason: 'Scope description is empty — fill it in before sending',
    };
  }

  const cslb = awarded.cslbLicense.trim();
  const notes = awarded.notes.trim();
  const newSub: SubBid = {
    id: newSubBidId(),
    contractorName,
    portionOfWork,
    bidAmountCents: awarded.bidAmountCents,
    fromLevelingScopeId: scope.id,
    ...(cslb ? { cslbLicense: cslb } : {}),
    ...(notes ? { notes } : {}),
  };

  const updated = await updateEstimate(
    id,
    { subBids: [...existing.subBids, newSub] },
    ctx,
  );
  if (!updated) {
    // Race: estimate disappeared between read and write. Treat as 404.
    return { ok: false, status: 404, reason: 'Estimate not found' };
  }
  return { ok: true, estimate: updated, subBidId: newSub.id };
}

/**
 * Historical-prices match. The editor surfaces these to the
 * estimator so they can see what they bid for the same kind of
 * line on past jobs.
 */
export interface HistoricalPriceMatch {
  estimateId: string;
  projectName: string;
  projectType: string;
  bidDueDate?: string;
  itemNumber: string;
  description: string;
  unit: string;
  quantity: number;
  unitPriceCents: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  /** ISO timestamp the estimate was created. Sort key. */
  createdAt: string;
}

/** Normalize a string for fuzzy matching: lowercase, strip non-alphanumeric. */
function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Search every priced estimate on disk for bid item lines whose
 * description normalizes to the same words as the query. Returns the
 * matches newest-first so the editor can show last-bid first.
 *
 * Filters out the current estimate so the search doesn't echo back
 * the line the user is staring at. Filters out unpriced lines so a
 * stale draft doesn't pollute the results.
 *
 * Phase 1 brute-force: walks each estimate file. With a few hundred
 * estimates this is fine (sub-second). When Postgres lands a real
 * GIN/trigram index replaces this loop.
 */
export async function findHistoricalPrices(opts: {
  description: string;
  unit?: string;
  projectType?: string;
  excludeEstimateId?: string;
  limit?: number;
}): Promise<HistoricalPriceMatch[]> {
  const target = normalizeForMatch(opts.description);
  if (!target) return [];
  const targetWords = new Set(target.split(' ').filter((w) => w.length >= 3));
  if (targetWords.size === 0) return [];

  const summaries = await listEstimates();
  const matches: HistoricalPriceMatch[] = [];

  for (const summary of summaries) {
    if (summary.id === opts.excludeEstimateId) continue;
    const est = await getEstimate(summary.id);
    if (!est) continue;
    if (opts.projectType && est.projectType !== opts.projectType) continue;
    for (const item of est.bidItems) {
      if (item.unitPriceCents == null) continue;
      if (opts.unit && item.unit !== opts.unit) continue;
      const desc = normalizeForMatch(item.description);
      if (!desc) continue;
      // Score = number of target words present in the candidate
      // description. Require at least 60% overlap so noise lines
      // ("Item 3", etc.) don't crowd the list.
      const descWords = new Set(desc.split(' '));
      let hit = 0;
      for (const w of targetWords) if (descWords.has(w)) hit += 1;
      const overlap = hit / targetWords.size;
      if (overlap < 0.6) continue;
      matches.push({
        estimateId: est.id,
        projectName: est.projectName,
        projectType: est.projectType,
        bidDueDate: est.bidDueDate,
        itemNumber: item.itemNumber,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        confidence: item.confidence,
        createdAt: est.createdAt,
      });
    }
  }

  matches.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return matches.slice(0, opts.limit ?? 10);
}

/**
 * One row of the variance check: how the line's current unit price
 * compares to past bids on similar lines.
 */
export interface VarianceRow {
  /** Index into the estimate's bidItems array. */
  itemIndex: number;
  /** Median of historical unit prices in cents. Null if no matches. */
  historicalMedianCents: number | null;
  /** How many historical bids backed the median. */
  historicalCount: number;
  /** Current vs. historical, decimal: 0 = matches, +0.5 = 50% above,
   *  -0.3 = 30% below. Null if no historical data. */
  deviation: number | null;
}

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}

/**
 * Variance scan for every line in a saved estimate. For each priced
 * line we look up similar lines in past estimates and compute the
 * median historical unit price. The editor highlights any cell whose
 * current price is meaningfully off (>50% in either direction) so
 * the estimator catches typos and misreads at a glance.
 */
export async function computeVariance(id: string): Promise<VarianceRow[]> {
  const est = await getEstimate(id);
  if (!est) return [];
  const out: VarianceRow[] = [];
  for (let i = 0; i < est.bidItems.length; i += 1) {
    const item = est.bidItems[i]!;
    if (item.unitPriceCents == null) {
      out.push({
        itemIndex: i,
        historicalMedianCents: null,
        historicalCount: 0,
        deviation: null,
      });
      continue;
    }
    const matches = await findHistoricalPrices({
      description: item.description,
      unit: item.unit,
      excludeEstimateId: id,
      limit: 25,
    });
    if (matches.length === 0) {
      out.push({
        itemIndex: i,
        historicalMedianCents: null,
        historicalCount: 0,
        deviation: null,
      });
      continue;
    }
    const med = median(matches.map((m) => m.unitPriceCents));
    const dev = med > 0 ? (item.unitPriceCents - med) / med : 0;
    out.push({
      itemIndex: i,
      historicalMedianCents: med,
      historicalCount: matches.length,
      deviation: dev,
    });
  }
  return out;
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
