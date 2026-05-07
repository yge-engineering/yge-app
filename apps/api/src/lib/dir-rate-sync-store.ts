// Postgres-backed store for DIR rate sync runs + proposals.
//
// Sync runs go in DirRateSyncRun; proposals in DirRateProposal. Both
// keep the full Zod object in `data: Json` plus pull out the columns
// the UI filters on (status / syncRunId / classification / county).

import { prisma } from '@yge/db';
import {
  DirRateProposalSchema,
  DirRateSyncRunSchema,
  type DirRateProposal,
  type DirRateProposalStatus,
  type DirRateSyncRun,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';
import { getRequestCompanyId } from './request-context';

const FALLBACK_COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
function companyId(): string {
  return getRequestCompanyId() ?? FALLBACK_COMPANY_ID;
}

// ---- Sync run persistence ------------------------------------------------

function row2run(row: { data: unknown }): DirRateSyncRun | null {
  const r = DirRateSyncRunSchema.safeParse(row.data);
  return r.success ? r.data : null;
}

export async function listSyncRuns(): Promise<DirRateSyncRun[]> {
  const rows = await prisma.dirRateSyncRun.findMany({
    where: { companyId: companyId() },
    orderBy: { startedAt: 'desc' },
  });
  return rows.map(row2run).filter((r): r is DirRateSyncRun => r !== null);
}

export async function getSyncRun(id: string): Promise<DirRateSyncRun | null> {
  if (!/^dir-sync-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.dirRateSyncRun.findFirst({
    where: { id, companyId: companyId() },
  });
  if (!row) return null;
  return row2run(row);
}

async function persistRun(r: DirRateSyncRun): Promise<void> {
  await prisma.dirRateSyncRun.upsert({
    where: { id: r.id },
    create: {
      id: r.id,
      companyId: companyId(),
      startedAt: r.startedAt ? new Date(r.startedAt) : new Date(r.createdAt),
      finishedAt: r.finishedAt ? new Date(r.finishedAt) : null,
      status: r.status,
      data: r as unknown as object,
    },
    update: {
      startedAt: r.startedAt ? new Date(r.startedAt) : new Date(r.createdAt),
      finishedAt: r.finishedAt ? new Date(r.finishedAt) : null,
      status: r.status,
      data: r as unknown as object,
    },
  });
}

export type CreateSyncRunInput = Pick<DirRateSyncRun, 'source'> & Partial<DirRateSyncRun>;

export async function createSyncRun(
  input: CreateSyncRunInput,
  ctx?: AuditContext,
): Promise<DirRateSyncRun> {
  const now = new Date().toISOString();
  const id = newSyncRunId();
  const r: DirRateSyncRun = DirRateSyncRunSchema.parse({
    id,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'QUEUED',
    ...input,
  });
  await persistRun(r);
  await recordAudit({
    action: 'create',
    entityType: 'DirRateSchedule',
    entityId: id,
    after: r,
    ctx,
  });
  return r;
}

export async function updateSyncRunStatus(
  id: string,
  patch: Partial<Pick<DirRateSyncRun,
    | 'status'
    | 'startedAt'
    | 'finishedAt'
    | 'proposalsCreated'
    | 'classificationsScraped'
    | 'classificationsFailed'
    | 'summary'
    | 'errorMessages'
  >>,
  ctx?: AuditContext,
): Promise<DirRateSyncRun | null> {
  const existing = await getSyncRun(id);
  if (!existing) return null;
  const updated: DirRateSyncRun = DirRateSyncRunSchema.parse({
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  });
  await persistRun(updated);
  await recordAudit({
    action: patch.status === 'SUCCESS' ? 'import' : 'update',
    entityType: 'DirRateSchedule',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}

// ---- Proposal persistence -----------------------------------------------

function row2prop(row: { data: unknown }): DirRateProposal | null {
  const r = DirRateProposalSchema.safeParse(row.data);
  return r.success ? r.data : null;
}

export interface ListProposalsFilter {
  status?: DirRateProposalStatus;
  syncRunId?: string;
  classification?: string;
  county?: string;
}

export async function listProposals(filter: ListProposalsFilter = {}): Promise<DirRateProposal[]> {
  const rows = await prisma.dirRateProposal.findMany({
    where: {
      companyId: companyId(),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.syncRunId ? { syncRunId: filter.syncRunId } : {}),
      ...(filter.classification ? { classification: filter.classification } : {}),
      ...(filter.county ? { county: filter.county } : {}),
    },
  });
  return rows.map(row2prop).filter((p): p is DirRateProposal => p !== null);
}

export async function getProposal(id: string): Promise<DirRateProposal | null> {
  if (!/^dir-prop-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.dirRateProposal.findFirst({
    where: { id, companyId: companyId() },
  });
  if (!row) return null;
  return row2prop(row);
}

async function persistProposal(p: DirRateProposal): Promise<void> {
  await prisma.dirRateProposal.upsert({
    where: { id: p.id },
    create: {
      id: p.id,
      companyId: companyId(),
      syncRunId: p.syncRunId,
      status: p.status,
      classification: p.classification,
      county: p.county,
      data: p as unknown as object,
    },
    update: {
      syncRunId: p.syncRunId,
      status: p.status,
      classification: p.classification,
      county: p.county,
      data: p as unknown as object,
    },
  });
}

export type CreateProposalInput = Pick<
  DirRateProposal,
  'syncRunId' | 'classification' | 'county' | 'existingRateId' | 'proposedRate'
> & Partial<DirRateProposal>;

export async function createProposal(
  input: CreateProposalInput,
  ctx?: AuditContext,
): Promise<DirRateProposal> {
  const now = new Date().toISOString();
  const id = newProposalId();
  const p: DirRateProposal = DirRateProposalSchema.parse({
    id,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'PENDING',
    ...input,
  });
  await persistProposal(p);
  await recordAudit({
    action: 'create',
    entityType: 'DirRateSchedule',
    entityId: id,
    after: p,
    ctx,
  });
  return p;
}

export async function acceptProposal(
  id: string,
  reviewedByUserId: string | null,
  reviewNote?: string,
  ctx?: AuditContext,
): Promise<DirRateProposal | null> {
  const existing = await getProposal(id);
  if (!existing) return null;
  if (existing.status !== 'PENDING') return existing;
  const updated: DirRateProposal = {
    ...existing,
    status: 'ACCEPTED',
    reviewedAt: new Date().toISOString(),
    reviewedByUserId: reviewedByUserId ?? undefined,
    reviewNote,
    updatedAt: new Date().toISOString(),
  };
  await persistProposal(updated);
  await recordAudit({
    action: 'approve',
    entityType: 'DirRateSchedule',
    entityId: id,
    before: existing,
    after: updated,
    ctx: { ...ctx, reason: reviewNote ?? ctx?.reason },
  });
  return updated;
}

export async function rejectProposal(
  id: string,
  reviewedByUserId: string | null,
  reviewNote: string,
  ctx?: AuditContext,
): Promise<DirRateProposal | null> {
  const existing = await getProposal(id);
  if (!existing) return null;
  if (existing.status !== 'PENDING') return existing;
  const updated: DirRateProposal = {
    ...existing,
    status: 'REJECTED',
    reviewedAt: new Date().toISOString(),
    reviewedByUserId: reviewedByUserId ?? undefined,
    reviewNote,
    updatedAt: new Date().toISOString(),
  };
  await persistProposal(updated);
  await recordAudit({
    action: 'reject',
    entityType: 'DirRateSchedule',
    entityId: id,
    before: existing,
    after: updated,
    ctx: { ...ctx, reason: reviewNote },
  });
  return updated;
}

// ---- Id helpers (re-exported from shared in the route layer) ------------

function newSyncRunId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `dir-sync-${hex.padStart(8, '0')}`;
}
function newProposalId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `dir-prop-${hex.padStart(8, '0')}`;
}
