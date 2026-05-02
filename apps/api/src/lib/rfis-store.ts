// Every mutation here records an audit event via recordAudit() —
// CLAUDE.md mandates 'every mutation is audit-logged'.
//
// File-based store for RFIs.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  RfiSchema,
  newRfiId,
  type Rfi,
  type RfiCreate,
  type RfiPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

function dataDir(): string {
  return process.env.RFIS_DATA_DIR ?? path.resolve(process.cwd(), 'data', 'rfis');
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

async function readIndex(): Promise<Rfi[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = RfiSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((r): r is Rfi => r !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: Rfi[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function createRfi(
  input: RfiCreate,
  ctx?: AuditContext,
): Promise<Rfi> {
  await ensureDir();
  const now = new Date().toISOString();
  const id = newRfiId();
  const r: Rfi = {
    id,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'DRAFT',
    priority: input.priority ?? 'MEDIUM',
    question: input.question ?? '',
    costImpact: input.costImpact ?? false,
    scheduleImpact: input.scheduleImpact ?? false,
    ...input,
  };
  RfiSchema.parse(r);
  await fs.writeFile(rowPath(id), JSON.stringify(r, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(r);
  await writeIndex(index);
  await recordAudit({
    action: 'create',
    entityType: 'Rfi',
    entityId: id,
    after: r,
    ctx,
  });
  return r;
}

export async function listRfis(filter?: { jobId?: string; status?: string }): Promise<Rfi[]> {
  let all = await readIndex();
  if (filter?.jobId) all = all.filter((r) => r.jobId === filter.jobId);
  if (filter?.status) all = all.filter((r) => r.status === filter.status);
  // Newest sentAt first, then by rfiNumber.
  all.sort((a, b) => {
    const av = a.sentAt ?? a.createdAt.slice(0, 10);
    const bv = b.sentAt ?? b.createdAt.slice(0, 10);
    return bv.localeCompare(av);
  });
  return all;
}

export async function getRfi(id: string): Promise<Rfi | null> {
  if (!/^rfi-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return RfiSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function updateRfi(
  id: string,
  patch: RfiPatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'submit' | 'answer' = 'update',
): Promise<Rfi | null> {
  const existing = await getRfi(id);
  if (!existing) return null;
  const updated: Rfi = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  RfiSchema.parse(updated);
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
    entityType: 'Rfi',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
