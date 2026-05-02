// Every mutation here records an audit event via recordAudit() —
// CLAUDE.md mandates 'every mutation is audit-logged'.
//
// File-based store for bid results.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  BidResultSchema,
  newBidResultId,
  type BidResult,
  type BidResultCreate,
  type BidResultPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

function dataDir(): string {
  return (
    process.env.BID_RESULTS_DATA_DIR ??
    path.resolve(process.cwd(), 'data', 'bid-results')
  );
}
function indexPath(): string {
  return path.join(dataDir(), 'index.json');
}
function rowPath(id: string): string {
  return path.join(dataDir(), `${id}.json`);
}

async function ensureDir() {
  await fs.mkdir(dataDir(), { recursive: true });
}

async function readIndex(): Promise<BidResult[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = BidResultSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((r): r is BidResult => r !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: BidResult[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function createBidResult(
  input: BidResultCreate,
  ctx?: AuditContext,
): Promise<BidResult> {
  await ensureDir();
  const now = new Date().toISOString();
  const id = newBidResultId();
  const r: BidResult = {
    id,
    createdAt: now,
    updatedAt: now,
    outcome: input.outcome ?? 'TBD',
    bidders: input.bidders ?? [],
    ...input,
  };
  BidResultSchema.parse(r);
  await fs.writeFile(rowPath(id), JSON.stringify(r, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(r);
  await writeIndex(index);
  await recordAudit({
    action: 'create',
    entityType: 'BidResult',
    entityId: id,
    after: r,
    ctx,
  });
  return r;
}

export async function listBidResults(filter?: { jobId?: string }): Promise<BidResult[]> {
  let all = await readIndex();
  if (filter?.jobId) {
    all = all.filter((r) => r.jobId === filter.jobId);
  }
  all.sort((a, b) => b.bidOpenedAt.localeCompare(a.bidOpenedAt));
  return all;
}

export async function getBidResult(id: string): Promise<BidResult | null> {
  if (!/^bid-result-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return BidResultSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function updateBidResult(
  id: string,
  patch: BidResultPatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'reopen' = 'update',
): Promise<BidResult | null> {
  const existing = await getBidResult(id);
  if (!existing) return null;
  const updated: BidResult = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  BidResultSchema.parse(updated);
  await fs.writeFile(rowPath(id), JSON.stringify(updated, null, 2), 'utf8');
  const index = await readIndex();
  const idx = index.findIndex((r) => r.id === id);
  if (idx >= 0) {
    index[idx] = updated;
  } else {
    index.unshift(updated);
  }
  await writeIndex(index);
  await recordAudit({
    action: auditAction,
    entityType: 'BidResult',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
