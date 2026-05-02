// Every mutation here records an audit event via recordAudit() —
// CLAUDE.md mandates 'every mutation is audit-logged'.
//
// File-based store for daily dispatches.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  DispatchSchema,
  newDispatchId,
  type Dispatch,
  type DispatchCreate,
  type DispatchPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

function dataDir(): string {
  return process.env.DISPATCHES_DATA_DIR ?? path.resolve(process.cwd(), 'data', 'dispatches');
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

async function readIndex(): Promise<Dispatch[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = DispatchSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((d): d is Dispatch => d !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: Dispatch[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function createDispatch(
  input: DispatchCreate,
  ctx?: AuditContext,
): Promise<Dispatch> {
  await ensureDir();
  const now = new Date().toISOString();
  const id = newDispatchId();
  const d: Dispatch = {
    id,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'DRAFT',
    crew: input.crew ?? [],
    equipment: input.equipment ?? [],
    ...input,
  };
  DispatchSchema.parse(d);
  await fs.writeFile(rowPath(id), JSON.stringify(d, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(d);
  await writeIndex(index);
  await recordAudit({
    action: 'create',
    entityType: 'Dispatch',
    entityId: id,
    after: d,
    ctx,
  });
  return d;
}

export async function listDispatches(filter?: {
  jobId?: string;
  scheduledFor?: string;
  status?: string;
}): Promise<Dispatch[]> {
  let all = await readIndex();
  if (filter?.jobId) all = all.filter((d) => d.jobId === filter.jobId);
  if (filter?.scheduledFor)
    all = all.filter((d) => d.scheduledFor === filter.scheduledFor);
  if (filter?.status) all = all.filter((d) => d.status === filter.status);
  all.sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor));
  return all;
}

export async function getDispatch(id: string): Promise<Dispatch | null> {
  if (!/^disp-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return DispatchSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function updateDispatch(
  id: string,
  patch: DispatchPatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'cancel' = 'update',
): Promise<Dispatch | null> {
  const existing = await getDispatch(id);
  if (!existing) return null;
  const updated: Dispatch = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  DispatchSchema.parse(updated);
  await fs.writeFile(rowPath(id), JSON.stringify(updated, null, 2), 'utf8');
  const index = await readIndex();
  const idx = index.findIndex((d) => d.id === id);
  if (idx >= 0) {
    index[idx] = updated;
  } else {
    index.unshift(updated);
  }
  await writeIndex(index);
  await recordAudit({
    action: auditAction,
    entityType: 'Dispatch',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
