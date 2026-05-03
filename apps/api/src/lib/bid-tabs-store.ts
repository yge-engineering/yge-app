// File-backed bid-tab store. One JSON file per row +
// data/bid-tabs/index.json for fast list rendering.
//
// Phase 1 lives without a Postgres index — file scans are fine for
// the volume YGE encounters in early use. The shape of the rows
// matches BidTabSchema 1:1 so the file rows can be replayed into
// Prisma when DB persistence ships.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  BidTabSchema,
  linkYgeOnImport,
  newBidTabId,
  normalizeCompanyName,
  type BidTab,
  type BidTabCreate,
  type BidTabSource,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';
import { listBidResults } from './bid-results-store';
import { listJobs } from './jobs-store';

function dataDir(): string {
  return process.env.BID_TABS_DATA_DIR ?? path.resolve(process.cwd(), 'data', 'bid-tabs');
}
function indexPath(): string { return path.join(dataDir(), 'index.json'); }
function rowPath(id: string): string { return path.join(dataDir(), `${id}.json`); }

async function ensureDir() { await fs.mkdir(dataDir(), { recursive: true }); }

async function readIndex(): Promise<BidTab[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const r = BidTabSchema.safeParse(entry);
        return r.success ? r.data : null;
      })
      .filter((b): b is BidTab => b !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(rows: BidTab[]) {
  await fs.writeFile(indexPath(), JSON.stringify(rows, null, 2), 'utf8');
}

async function persist(t: BidTab) {
  await ensureDir();
  await fs.writeFile(rowPath(t.id), JSON.stringify(t, null, 2), 'utf8');
  const index = await readIndex();
  const at = index.findIndex((row) => row.id === t.id);
  if (at >= 0) index[at] = t;
  else index.unshift(t);
  await writeIndex(index);
}

export async function listBidTabs(filter?: {
  source?: BidTabSource;
  county?: string;
  ygeJobId?: string;
  search?: string;
}): Promise<BidTab[]> {
  let all = await readIndex();
  if (filter?.source) all = all.filter((t) => t.source === filter.source);
  if (filter?.county) {
    const c = filter.county.trim().toLowerCase();
    all = all.filter((t) => (t.county ?? '').toLowerCase() === c);
  }
  if (filter?.ygeJobId) all = all.filter((t) => t.ygeJobId === filter.ygeJobId);
  if (filter?.search) {
    const q = filter.search.trim().toLowerCase();
    if (q.length > 0) {
      all = all.filter((t) => {
        if (t.projectName.toLowerCase().includes(q)) return true;
        if (t.agencyName.toLowerCase().includes(q)) return true;
        if (t.projectNumber?.toLowerCase().includes(q)) return true;
        if (t.notes?.toLowerCase().includes(q)) return true;
        for (const b of t.bidders) {
          if (b.name.toLowerCase().includes(q)) return true;
        }
        return false;
      });
    }
  }
  // Newest open date first.
  all.sort((a, b) => (a.bidOpenedAt < b.bidOpenedAt ? 1 : -1));
  return all;
}

export async function getBidTab(id: string): Promise<BidTab | null> {
  if (!/^bidtab-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return BidTabSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function createBidTab(
  input: BidTabCreate,
  ctx?: AuditContext,
): Promise<BidTab> {
  const now = new Date().toISOString();

  // Auto-rank when bidders[].rank wasn't filled in (manual import flow
  // sometimes ships them in low-to-high order without explicit rank).
  let bidders = input.bidders;
  const allRanked = bidders.every((b) => Number.isFinite(b.rank) && b.rank > 0);
  if (!allRanked) {
    const sorted = [...bidders].sort((a, b) => a.totalCents - b.totalCents);
    bidders = sorted.map((b, i) => ({ ...b, rank: i + 1 }));
  }

  // Recompute nameNormalized server-side so the client can't drift
  // from the canonical normalization.
  bidders = bidders.map((b) => ({
    ...b,
    nameNormalized: normalizeCompanyName(b.name),
  }));

  // Mark the apparent low (rank 1) as awardedTo when the input row's
  // awardedToBidderName matches it; honor explicit awardedTo flags
  // on the input rows otherwise.
  const apparent = bidders.find((b) => b.rank === 1);
  if (apparent && input.awardedToBidderName) {
    bidders = bidders.map((b) => ({
      ...b,
      awardedTo: b.name === input.awardedToBidderName ? true : b.awardedTo,
    }));
  }

  let tab: BidTab = BidTabSchema.parse({
    ...input,
    bidders,
    state: input.state ?? 'CA',
    id: newBidTabId(),
    createdAt: now,
    updatedAt: now,
  });

  // Auto-link to a YGE BidResult when YGE was on the bidder list
  // and the operator didn't already supply ygeJobId / ygeBidResultId.
  // The matcher needs the BidResult collection joined with the Job
  // so it can read projectName / projectNumber for the match.
  if (!tab.ygeBidResultId) {
    const [bidResults, jobs] = await Promise.all([listBidResults(), listJobs()]);
    const jobsById = new Map(jobs.map((j) => [j.id, j]));
    const enrichedResults = bidResults.map((br) => {
      const j = jobsById.get(br.jobId);
      // Job currently has projectName but not projectNumber; the
      // matcher reads both via duck-typing so the absence of one
      // just makes that match strategy a no-op.
      const extra: { projectName?: string; projectNumber?: string } = {};
      if (j?.projectName) extra.projectName = j.projectName;
      const maybeNumber = (j as unknown as { projectNumber?: string } | undefined)?.projectNumber;
      if (maybeNumber) extra.projectNumber = maybeNumber;
      return { ...br, ...extra };
    });
    const linked = linkYgeOnImport({ tab, bidResults: enrichedResults });
    if (linked.matchedBidResultId && linked.matchedJobId) {
      tab = BidTabSchema.parse({
        ...tab,
        ygeJobId: tab.ygeJobId ?? linked.matchedJobId,
        ygeBidResultId: linked.matchedBidResultId,
      });
    }
  }

  await persist(tab);
  await recordAudit({
    action: 'import',
    entityType: 'BidResult',
    entityId: tab.id,
    before: null,
    after: tab,
    ctx,
  });
  return tab;
}

/**
 * Patch a tab's free-form notes. Operators tend to add post-import
 * context here ('Caltrans rejected Mercer's bid for missing sub
 * list — apparent low advanced to Knife River'), so the field gets
 * its own tiny endpoint instead of a kitchen-sink update form.
 *
 * Pass empty string to CLEAR the notes.
 */
export async function patchBidTabNotes(
  id: string,
  notes: string,
  ctx?: AuditContext,
): Promise<BidTab | null> {
  const existing = await getBidTab(id);
  if (!existing) return null;
  const trimmed = notes.trim();
  const updated = BidTabSchema.parse({
    ...existing,
    notes: trimmed.length === 0 ? undefined : trimmed,
    updatedAt: new Date().toISOString(),
  });
  await persist(updated);
  await recordAudit({
    action: 'update',
    entityType: 'BidResult',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}

/**
 * Patch the YGE cross-link fields on an existing tab. Used when
 * the auto-link in createBidTab didn't fire (typo in project
 * name, agency-prefix mismatch, etc.) and the operator manually
 * picks the right BidResult from the UI.
 *
 * Pass null to CLEAR a field; undefined leaves it untouched.
 */
export async function patchBidTabLink(
  id: string,
  patch: { ygeJobId?: string | null; ygeBidResultId?: string | null },
  ctx?: AuditContext,
): Promise<BidTab | null> {
  const existing = await getBidTab(id);
  if (!existing) return null;
  const updated = BidTabSchema.parse({
    ...existing,
    ygeJobId:
      patch.ygeJobId === undefined
        ? existing.ygeJobId
        : patch.ygeJobId === null
          ? undefined
          : patch.ygeJobId,
    ygeBidResultId:
      patch.ygeBidResultId === undefined
        ? existing.ygeBidResultId
        : patch.ygeBidResultId === null
          ? undefined
          : patch.ygeBidResultId,
    updatedAt: new Date().toISOString(),
  });
  await persist(updated);
  await recordAudit({
    action: 'update',
    entityType: 'BidResult',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}

export async function deleteBidTab(id: string, ctx?: AuditContext): Promise<boolean> {
  const existing = await getBidTab(id);
  if (!existing) return false;
  try { await fs.unlink(rowPath(id)); } catch { /* best effort */ }
  const index = await readIndex();
  const next = index.filter((row) => row.id !== id);
  await writeIndex(next);
  await recordAudit({
    action: 'delete',
    entityType: 'BidResult',
    entityId: id,
    before: existing,
    after: null,
    ctx,
  });
  return true;
}
