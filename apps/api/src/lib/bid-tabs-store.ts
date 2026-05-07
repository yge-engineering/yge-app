// Postgres-backed bid-tab store. The full BidTab Zod shape lives in
// the Json `data` column; jobId mirrors `tab.ygeJobId` so we can
// index lookups by job without parsing JSON.

import { prisma } from '@yge/db';
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
import { getRequestCompanyId } from './request-context';
import { listBidResults } from './bid-results-store';
import { listJobs } from './jobs-store';

const FALLBACK_COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
function companyId(): string {
  return getRequestCompanyId() ?? FALLBACK_COMPANY_ID;
}

function row2tab(row: { data: unknown }): BidTab | null {
  const r = BidTabSchema.safeParse(row.data);
  return r.success ? r.data : null;
}

async function persist(t: BidTab): Promise<void> {
  await prisma.bidTab.upsert({
    where: { id: t.id },
    create: {
      id: t.id,
      companyId: companyId(),
      jobId: t.ygeJobId ?? null,
      data: t as unknown as object,
    },
    update: {
      jobId: t.ygeJobId ?? null,
      data: t as unknown as object,
    },
  });
}

export async function listBidTabs(filter?: {
  source?: BidTabSource;
  county?: string;
  ygeJobId?: string;
  search?: string;
}): Promise<BidTab[]> {
  const rows = await prisma.bidTab.findMany({
    where: { companyId: companyId(), deletedAt: null },
  });
  let all = rows.map(row2tab).filter((t): t is BidTab => t !== null);
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
  const row = await prisma.bidTab.findFirst({
    where: { id, companyId: companyId(), deletedAt: null },
  });
  if (!row) return null;
  return row2tab(row);
}

export async function createBidTab(
  input: BidTabCreate,
  ctx?: AuditContext,
): Promise<BidTab> {
  const now = new Date().toISOString();

  let bidders = input.bidders;
  const allRanked = bidders.every((b) => Number.isFinite(b.rank) && b.rank > 0);
  if (!allRanked) {
    const sorted = [...bidders].sort((a, b) => a.totalCents - b.totalCents);
    bidders = sorted.map((b, i) => ({ ...b, rank: i + 1 }));
  }

  bidders = bidders.map((b) => ({
    ...b,
    nameNormalized: normalizeCompanyName(b.name),
  }));

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

  if (!tab.ygeBidResultId) {
    const [bidResults, jobs] = await Promise.all([listBidResults(), listJobs()]);
    const jobsById = new Map(jobs.map((j) => [j.id, j]));
    const enrichedResults = bidResults.map((br) => {
      const j = jobsById.get(br.jobId);
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

export async function patchBidTabCore(
  id: string,
  patch: {
    agencyName?: string;
    projectName?: string;
    projectNumber?: string | null;
    county?: string | null;
    bidOpenedAt?: string;
    engineersEstimateCents?: number | null;
    sourceUrl?: string | null;
    awardedToBidderName?: string | null;
    awardedAt?: string | null;
  },
  ctx?: AuditContext,
): Promise<BidTab | null> {
  const existing = await getBidTab(id);
  if (!existing) return null;
  const nextAwardedName =
    patch.awardedToBidderName === undefined
      ? existing.awardedToBidderName
      : patch.awardedToBidderName === null
        ? undefined
        : patch.awardedToBidderName;

  let bidders = existing.bidders;
  if (patch.awardedToBidderName !== undefined) {
    bidders = existing.bidders.map((b) => ({
      ...b,
      awardedTo: nextAwardedName ? b.name === nextAwardedName : false,
    }));
  }

  const next: BidTab = {
    ...existing,
    agencyName: patch.agencyName ?? existing.agencyName,
    projectName: patch.projectName ?? existing.projectName,
    projectNumber:
      patch.projectNumber === undefined
        ? existing.projectNumber
        : patch.projectNumber === null
          ? undefined
          : patch.projectNumber,
    county:
      patch.county === undefined
        ? existing.county
        : patch.county === null
          ? undefined
          : patch.county,
    bidOpenedAt: patch.bidOpenedAt ?? existing.bidOpenedAt,
    engineersEstimateCents:
      patch.engineersEstimateCents === undefined
        ? existing.engineersEstimateCents
        : patch.engineersEstimateCents === null
          ? undefined
          : patch.engineersEstimateCents,
    sourceUrl:
      patch.sourceUrl === undefined
        ? existing.sourceUrl
        : patch.sourceUrl === null
          ? undefined
          : patch.sourceUrl,
    awardedToBidderName: nextAwardedName,
    awardedAt:
      patch.awardedAt === undefined
        ? existing.awardedAt
        : patch.awardedAt === null
          ? undefined
          : patch.awardedAt,
    bidders,
    updatedAt: new Date().toISOString(),
  };
  const updated = BidTabSchema.parse(next);
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

export async function patchBidTabBidders(
  id: string,
  bidders: Array<{
    rank?: number;
    name: string;
    nameNormalized?: string;
    totalCents: number;
    cslbLicense?: string;
    dirRegistration?: string;
    dbe?: boolean;
    sbe?: boolean;
    withdrawn?: boolean;
    rejected?: boolean;
    rejectionReason?: string;
    notes?: string;
  }>,
  ctx?: AuditContext,
): Promise<BidTab | null> {
  const existing = await getBidTab(id);
  if (!existing) return null;

  let ordered = bidders;
  const allRanked = bidders.every((b) => Number.isFinite(b.rank) && (b.rank ?? 0) > 0);
  if (!allRanked) {
    ordered = [...bidders]
      .sort((a, b) => a.totalCents - b.totalCents)
      .map((b, i) => ({ ...b, rank: i + 1 }));
  }

  const awarded = existing.awardedToBidderName;
  const normalized = ordered.map((b) => ({
    rank: b.rank ?? 0,
    name: b.name,
    nameNormalized: normalizeCompanyName(b.name),
    totalCents: b.totalCents,
    cslbLicense: b.cslbLicense,
    dirRegistration: b.dirRegistration,
    dbe: b.dbe,
    sbe: b.sbe,
    awardedTo: awarded ? b.name === awarded : false,
    withdrawn: b.withdrawn,
    rejected: b.rejected,
    rejectionReason: b.rejectionReason,
    notes: b.notes,
  }));

  let next: BidTab = BidTabSchema.parse({
    ...existing,
    bidders: normalized,
    updatedAt: new Date().toISOString(),
  });

  if (!next.ygeBidResultId) {
    const [bidResults, jobs] = await Promise.all([listBidResults(), listJobs()]);
    const jobsById = new Map(jobs.map((j) => [j.id, j]));
    const enrichedResults = bidResults.map((br) => {
      const j = jobsById.get(br.jobId);
      const extra: { projectName?: string; projectNumber?: string } = {};
      if (j?.projectName) extra.projectName = j.projectName;
      const maybeNumber = (j as unknown as { projectNumber?: string } | undefined)?.projectNumber;
      if (maybeNumber) extra.projectNumber = maybeNumber;
      return { ...br, ...extra };
    });
    const linked = linkYgeOnImport({ tab: next, bidResults: enrichedResults });
    if (linked.matchedBidResultId && linked.matchedJobId) {
      next = BidTabSchema.parse({
        ...next,
        ygeJobId: next.ygeJobId ?? linked.matchedJobId,
        ygeBidResultId: linked.matchedBidResultId,
      });
    }
  }

  await persist(next);
  await recordAudit({
    action: 'update',
    entityType: 'BidResult',
    entityId: id,
    before: existing,
    after: next,
    ctx,
  });
  return next;
}

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
  await prisma.bidTab.delete({ where: { id } });
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
