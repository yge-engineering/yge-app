// Every mutation here records an audit event via recordAudit() —
// CLAUDE.md mandates 'every mutation is audit-logged'.
//
// File-based store for punch list items.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  PunchItemSchema,
  newPunchItemId,
  type PunchItem,
  type PunchItemCreate,
  type PunchItemPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

function dataDir(): string {
  return process.env.PUNCH_ITEMS_DATA_DIR ?? path.resolve(process.cwd(), 'data', 'punch-items');
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

async function readIndex(): Promise<PunchItem[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = PunchItemSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((p): p is PunchItem => p !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: PunchItem[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function createPunchItem(
  input: PunchItemCreate,
  ctx?: AuditContext,
): Promise<PunchItem> {
  await ensureDir();
  const now = new Date().toISOString();
  const id = newPunchItemId();
  const p: PunchItem = {
    id,
    createdAt: now,
    updatedAt: now,
    severity: input.severity ?? 'MINOR',
    status: input.status ?? 'OPEN',
    ...input,
  };
  PunchItemSchema.parse(p);
  await fs.writeFile(rowPath(id), JSON.stringify(p, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(p);
  await writeIndex(index);
  await recordAudit({
    action: 'create',
    entityType: 'PunchItem',
    entityId: id,
    after: p,
    ctx,
  });
  return p;
}

export async function listPunchItems(filter?: {
  jobId?: string;
  status?: string;
}): Promise<PunchItem[]> {
  let all = await readIndex();
  if (filter?.jobId) all = all.filter((p) => p.jobId === filter.jobId);
  if (filter?.status) all = all.filter((p) => p.status === filter.status);
  // Sort: open + overdue first, then by due date asc, then identifiedOn desc.
  all.sort((a, b) => {
    const aOpen = a.status !== 'CLOSED' && a.status !== 'WAIVED' ? 0 : 1;
    const bOpen = b.status !== 'CLOSED' && b.status !== 'WAIVED' ? 0 : 1;
    if (aOpen !== bOpen) return aOpen - bOpen;
    if (a.dueOn && b.dueOn) return a.dueOn.localeCompare(b.dueOn);
    if (a.dueOn) return -1;
    if (b.dueOn) return 1;
    return b.identifiedOn.localeCompare(a.identifiedOn);
  });
  return all;
}

export async function getPunchItem(id: string): Promise<PunchItem | null> {
  if (!/^pi-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return PunchItemSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function updatePunchItem(
  id: string,
  patch: PunchItemPatch,
  ctx?: AuditContext,
  auditAction: 'update' = 'update',
): Promise<PunchItem | null> {
  const existing = await getPunchItem(id);
  if (!existing) return null;
  const updated: PunchItem = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  PunchItemSchema.parse(updated);
  await fs.writeFile(rowPath(id), JSON.stringify(updated, null, 2), 'utf8');
  const index = await readIndex();
  const idx = index.findIndex((p) => p.id === id);
  if (idx >= 0) {
    index[idx] = updated;
  } else {
    index.unshift(updated);
  }
  await writeIndex(index);
  await recordAudit({
    action: auditAction,
    entityType: 'PunchItem',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
