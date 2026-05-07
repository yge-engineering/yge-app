// Postgres-backed store for priced estimates.
//
// The full PricedEstimate Zod shape lives in `data: Json?`. The
// Prisma BidItem + CostLine relations stay empty for now — they're
// the normalized representation the future does-it-right Phase 3
// will populate.

import { prisma } from '@yge/db';
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
import { getRequestCompanyId } from './request-context';

const FALLBACK_COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
function companyId(): string {
  return getRequestCompanyId() ?? FALLBACK_COMPANY_ID;
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
  bidTotalCents: number;
  subBidCount: number;
  addendumCount: number;
  unacknowledgedAddendumCount: number;
  bidStatus?: 'pursuing' | 'submitted' | 'awarded' | 'lost';
  bidSubmittedAt?: string;
  notesPreview?: string;
  reviewedLineCount: number;
}

export interface CreateFromDraftInput {
  fromDraftId: string;
  jobId: string;
  draft: PtoEOutput;
  oppPercent?: number;
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
  const rand = randomBytes(4).toString('hex');
  return `est-${date}-${slug}-${rand}`;
}

function summarize(est: PricedEstimate): EstimateSummary {
  let priced = 0;
  let unpriced = 0;
  let reviewed = 0;
  let directCents = 0;
  for (const item of est.bidItems) {
    if (item.reviewState === 'accepted') reviewed++;
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
    bidStatus: est.bidStatus,
    bidSubmittedAt: est.bidSubmittedAt,
    notesPreview: est.notes
      ? est.notes.length > 120
        ? est.notes.slice(0, 120).trimEnd() + '…'
        : est.notes
      : undefined,
    reviewedLineCount: reviewed,
  };
}

function row2est(row: { data: unknown }): PricedEstimate | null {
  if (!row.data) return null;
  const r = PricedEstimateSchema.safeParse(row.data);
  return r.success ? r.data : null;
}

async function persist(est: PricedEstimate): Promise<void> {
  await prisma.estimate.upsert({
    where: { id: est.id },
    create: {
      id: est.id,
      companyId: companyId(),
      jobId: est.jobId,
      revision: 1,
      status: 'DRAFT',
      notes: est.notes ?? null,
      data: est as unknown as object,
    },
    update: {
      jobId: est.jobId,
      notes: est.notes ?? null,
      data: est as unknown as object,
    },
  });
}

export async function createFromDraft(
  input: CreateFromDraftInput,
  ctx?: AuditContext,
): Promise<PricedEstimate> {
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
  PricedEstimateSchema.parse(est);
  await persist(est);
  await recordAudit({
    action: 'create',
    entityType: 'Estimate',
    entityId: id,
    after: est,
    ctx,
  });
  return est;
}

export interface CreateBlankInput {
  jobId: string;
  projectName: string;
  projectType?: PricedEstimate['projectType'];
  ownerAgency?: string;
  location?: string;
  bidDueDate?: string;
  oppPercent?: number;
}

export async function createBlankEstimate(
  input: CreateBlankInput,
  ctx?: AuditContext,
): Promise<PricedEstimate> {
  const now = new Date();
  const id = makeId(input.projectName, now);
  const iso = now.toISOString();
  const seedItem: PricedBidItem = {
    itemNumber: '1',
    description: 'New line — replace me',
    unit: 'LS',
    quantity: 1,
    confidence: 'HIGH',
    unitPriceCents: null,
  };
  const est: PricedEstimate = {
    id,
    fromDraftId: 'manual',
    jobId: input.jobId,
    createdAt: iso,
    updatedAt: iso,
    projectName: input.projectName,
    projectType: input.projectType ?? 'OTHER',
    location: input.location,
    ownerAgency: input.ownerAgency,
    bidDueDate: input.bidDueDate,
    bidItems: [seedItem],
    oppPercent: input.oppPercent ?? 0.2,
    subBids: [],
    addenda: [],
    subLeveling: [],
  };
  PricedEstimateSchema.parse(est);
  await persist(est);
  await recordAudit({
    action: 'create',
    entityType: 'Estimate',
    entityId: id,
    after: est,
    ctx,
  });
  return est;
}


export interface ImportEstimateInput {
  jobId: string;
  projectName: string;
  projectType?: PricedEstimate['projectType'];
  ownerAgency?: string;
  location?: string;
  bidDueDate?: string;
  oppPercent?: number;
  bidItems: PricedBidItem[];
}

/** Build a PricedEstimate from imported bid items (CSV upload, etc.).
 *  Behaves like createBlankEstimate but uses the caller's items
 *  instead of seeding a placeholder row. */
export async function createEstimateFromImport(
  input: ImportEstimateInput,
  ctx?: AuditContext,
): Promise<PricedEstimate> {
  const now = new Date();
  const id = makeId(input.projectName, now);
  const iso = now.toISOString();
  const est: PricedEstimate = {
    id,
    fromDraftId: 'imported',
    jobId: input.jobId,
    createdAt: iso,
    updatedAt: iso,
    projectName: input.projectName,
    projectType: input.projectType ?? 'OTHER',
    location: input.location,
    ownerAgency: input.ownerAgency,
    bidDueDate: input.bidDueDate,
    bidItems: input.bidItems.length > 0
      ? input.bidItems
      : [
          {
            itemNumber: '1',
            description: 'New line — replace me',
            unit: 'LS',
            quantity: 1,
            confidence: 'HIGH',
            unitPriceCents: null,
          },
        ],
    oppPercent: input.oppPercent ?? 0.2,
    subBids: [],
    addenda: [],
    subLeveling: [],
  };
  PricedEstimateSchema.parse(est);
  await persist(est);
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
  const rows = await prisma.estimate.findMany({
    where: { companyId: companyId(), deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  return rows
    .map(row2est)
    .filter((e): e is PricedEstimate => e !== null)
    .map(summarize);
}

export async function getEstimate(id: string): Promise<PricedEstimate | null> {
  if (!/^est-[a-z0-9-]{10,80}$/.test(id)) return null;
  const row = await prisma.estimate.findFirst({
    where: { id, companyId: companyId(), deletedAt: null },
  });
  if (!row) return null;
  return row2est(row);
}

export interface EstimatePatch {
  oppPercent?: number;
  notes?: string;
  bidItems?: PricedBidItem[];
  subBids?: SubBid[];
  bidSecurity?: BidSecurity | null;
  addenda?: Addendum[];
  subLeveling?: PricedEstimate['subLeveling'];
  markup?: PricedEstimate['markup'];
  perUnitPrice?: PricedEstimate['perUnitPrice'] | null;
  bidStatus?: 'pursuing' | 'submitted' | 'awarded' | 'lost';
  bidSubmittedAt?: string | null;
}

export async function updateEstimate(
  id: string,
  patch: EstimatePatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'submit' | 'sign' | 'archive' = 'update',
): Promise<PricedEstimate | null> {
  const existing = await getEstimate(id);
  if (!existing) return null;

  const flippingToSubmitted =
    patch.bidStatus === 'submitted' && existing.bidStatus !== 'submitted';
  const autoSubmittedAt = flippingToSubmitted && !existing.bidSubmittedAt
    ? new Date().toISOString()
    : undefined;

  const updated: PricedEstimate = {
    ...existing,
    ...(patch.oppPercent != null ? { oppPercent: patch.oppPercent } : {}),
    ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
    ...(patch.bidStatus ? { bidStatus: patch.bidStatus } : {}),
    ...(patch.bidSubmittedAt !== undefined
      ? { bidSubmittedAt: patch.bidSubmittedAt ?? undefined }
      : autoSubmittedAt
        ? { bidSubmittedAt: autoSubmittedAt }
        : {}),
    ...(patch.bidItems ? { bidItems: patch.bidItems } : {}),
    ...(patch.subBids ? { subBids: patch.subBids } : {}),
    ...(patch.bidSecurity !== undefined
      ? { bidSecurity: patch.bidSecurity ?? undefined }
      : {}),
    ...(patch.addenda ? { addenda: patch.addenda } : {}),
    ...(patch.subLeveling ? { subLeveling: patch.subLeveling } : {}),
    ...(patch.markup ? { markup: patch.markup } : {}),
    ...(patch.perUnitPrice !== undefined
      ? { perUnitPrice: patch.perUnitPrice ?? undefined }
      : {}),
    updatedAt: new Date().toISOString(),
  };
  PricedEstimateSchema.parse(updated);
  await persist(updated);
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

export type PromoteAwardedResult =
  | { ok: true; estimate: PricedEstimate; subBidId: string }
  | { ok: false; status: 400 | 404; reason: string };

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
    return { ok: false, status: 404, reason: 'Estimate not found' };
  }
  return { ok: true, estimate: updated, subBidId: newSub.id };
}

export async function createFromTemplate(input: {
  sourceEstimateId: string;
  jobId: string;
  projectName?: string;
  oppPercent?: number;
}, ctx?: AuditContext): Promise<PricedEstimate | null> {
  const source = await getEstimate(input.sourceEstimateId);
  if (!source) return null;

  const now = new Date();
  const projectName = input.projectName?.trim() || source.projectName;
  const id = makeId(projectName, now);
  const iso = now.toISOString();
  const newEst: PricedEstimate = {
    id,
    fromDraftId: source.fromDraftId,
    jobId: input.jobId,
    createdAt: iso,
    updatedAt: iso,
    projectName,
    projectType: source.projectType,
    location: source.location,
    ownerAgency: source.ownerAgency,
    bidDueDate: undefined,
    bidItems: source.bidItems.map((it) => ({
      ...it,
      reviewState: undefined,
    })),
    oppPercent: input.oppPercent ?? source.oppPercent,
    notes: source.notes,
    subBids: [],
    addenda: [],
    subLeveling: [],
    ...(source.markup ? { markup: source.markup } : {}),
  };
  PricedEstimateSchema.parse(newEst);
  await persist(newEst);
  await recordAudit({
    action: 'create',
    entityType: 'Estimate',
    entityId: id,
    after: newEst,
    ctx,
  });
  return newEst;
}

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
  createdAt: string;
}

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Search every saved estimate for bid items whose description
 *  fuzzy-matches the query. Newest first.
 *
 *  Brute-force scan over all estimates — fine for a few hundred rows.
 *  When volume grows we'll move to a Postgres trigram + GIN index. */
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

  const rows = await prisma.estimate.findMany({
    where: { companyId: companyId(), deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  const all = rows.map(row2est).filter((e): e is PricedEstimate => e !== null);

  const matches: HistoricalPriceMatch[] = [];
  for (const est of all) {
    if (est.id === opts.excludeEstimateId) continue;
    if (opts.projectType && est.projectType !== opts.projectType) continue;
    for (const item of est.bidItems) {
      if (item.unitPriceCents == null) continue;
      if (opts.unit && item.unit !== opts.unit) continue;
      const desc = normalizeForMatch(item.description);
      if (!desc) continue;
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

export interface VarianceRow {
  itemIndex: number;
  historicalMedianCents: number | null;
  historicalCount: number;
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

export async function setLineUnitPrice(
  id: string,
  itemIndex: number,
  unitPriceCents: number | null,
): Promise<PricedEstimate | null> {
  const existing = await getEstimate(id);
  if (!existing) return null;
  if (itemIndex < 0 || itemIndex >= existing.bidItems.length) return null;
  const items = existing.bidItems.slice();
  items[itemIndex] = { ...items[itemIndex]!, unitPriceCents };
  return updateEstimate(id, { bidItems: items });
}
