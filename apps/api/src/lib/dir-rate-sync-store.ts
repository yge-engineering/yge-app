// File-based store for DIR rate sync runs + proposals.
//
// Every mutation here records an audit event via recordAudit() —
// CLAUDE.md mandates 'every mutation is audit-logged'. Sync runs +
// proposals are particularly important to log: they're the gate
// between DIR's website and the live rates that drive payroll, so
// the audit trail is the answer to 'who accepted that proposal that
// changed the OE Group 4 rate by $2.10?'

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  DirRateProposalSchema,
  DirRateSyncRunSchema,
  type DirRateProposal,
  type DirRateProposalStatus,
  type DirRateSyncRun,
  type DirRateSyncStatus,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

// ---- Sync run persistence ------------------------------------------------

function runDir(): string {
  return (
    process.env.DIR_RATE_SYNC_RUNS_DATA_DIR ??
    path.resolve(process.cwd(), 'data', 'dir-rate-sync-runs')
  );
}
function runIndexPath(): string { return path.join(runDir(), 'index.json'); }
function runRowPath(id: string): string { return path.join(runDir(), `${id}.json`); }

async function ensureRunDir() { await fs.mkdir(runDir(), { recursive: true }); }

async function readRunIndex(): Promise<DirRateSyncRun[]> {
  try {
    const raw = await fs.readFile(runIndexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const r = DirRateSyncRunSchema.safeParse(entry);
        return r.success ? r.data : null;
      })
      .filter((r): r is DirRateSyncRun => r !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeRunIndex(rows: DirRateSyncRun[]) {
  await fs.writeFile(runIndexPath(), JSON.stringify(rows, null, 2), 'utf8');
}

export async function listSyncRuns(): Promise<DirRateSyncRun[]> {
  return readRunIndex();
}

export async function getSyncRun(id: string): Promise<DirRateSyncRun | null> {
  if (!/^dir-sync-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(runRowPath(id), 'utf8');
    return DirRateSyncRunSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

async function persistRun(r: DirRateSyncRun) {
  await ensureRunDir();
  await fs.writeFile(runRowPath(r.id), JSON.stringify(r, null, 2), 'utf8');
  const idx = await readRunIndex();
  const at = idx.findIndex((row) => row.id === r.id);
  if (at >= 0) idx[at] = r;
  else idx.unshift(r);
  await writeRunIndex(idx);
}

export async function createSyncRun(
  input: Omit<DirRateSyncRun, 'id' | 'createdAt' | 'updatedAt' | 'status'> & {
    status?: DirRateSyncStatus;
  },
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

function propDir(): string {
  return (
    process.env.DIR_RATE_PROPOSALS_DATA_DIR ??
    path.resolve(process.cwd(), 'data', 'dir-rate-proposals')
  );
}
function propIndexPath(): string { return path.join(propDir(), 'index.json'); }
function propRowPath(id: string): string { return path.join(propDir(), `${id}.json`); }

async function ensurePropDir() { await fs.mkdir(propDir(), { recursive: true }); }

async function readPropIndex(): Promise<DirRateProposal[]> {
  try {
    const raw = await fs.readFile(propIndexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const r = DirRateProposalSchema.safeParse(entry);
        return r.success ? r.data : null;
      })
      .filter((r): r is DirRateProposal => r !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writePropIndex(rows: DirRateProposal[]) {
  await fs.writeFile(propIndexPath(), JSON.stringify(rows, null, 2), 'utf8');
}

export interface ListProposalsFilter {
  status?: DirRateProposalStatus;
  syncRunId?: string;
  classification?: string;
  county?: string;
}

export async function listProposals(filter: ListProposalsFilter = {}): Promise<DirRateProposal[]> {
  let rows = await readPropIndex();
  if (filter.status) rows = rows.filter((r) => r.status === filter.status);
  if (filter.syncRunId) rows = rows.filter((r) => r.syncRunId === filter.syncRunId);
  if (filter.classification) rows = rows.filter((r) => r.classification === filter.classification);
  if (filter.county) rows = rows.filter((r) => r.county === filter.county);
  return rows;
}

export async function getProposal(id: string): Promise<DirRateProposal | null> {
  if (!/^dir-prop-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(propRowPath(id), 'utf8');
    return DirRateProposalSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

async function persistProposal(p: DirRateProposal) {
  await ensurePropDir();
  await fs.writeFile(propRowPath(p.id), JSON.stringify(p, null, 2), 'utf8');
  const idx = await readPropIndex();
  const at = idx.findIndex((row) => row.id === p.id);
  if (at >= 0) idx[at] = p;
  else idx.unshift(p);
  await writePropIndex(idx);
}

export async function createProposal(
  input: Omit<DirRateProposal, 'id' | 'createdAt' | 'updatedAt' | 'status'> & {
    status?: DirRateProposalStatus;
  },
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

/**
 * Mark a proposal accepted. Caller is responsible for applying the
 * accepted application to the live rate store (see
 * buildAcceptedApplication in shared/dir-rate-sync). This function
 * just flips the proposal's status.
 */
export async function acceptProposal(
  id: string,
  reviewedByUserId: string | null,
  reviewNote?: string,
  ctx?: AuditContext,
): Promise<DirRateProposal | null> {
  const existing = await getProposal(id);
  if (!existing) return null;
  if (existing.status !== 'PENDING') return existing; // idempotent — return as-is on already-decided proposals
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
