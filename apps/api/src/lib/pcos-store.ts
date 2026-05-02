// Every mutation here records an audit event via recordAudit() —
// CLAUDE.md mandates 'every mutation is audit-logged'.
//
// File-based store for PCOs.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  PcoSchema,
  newPcoId,
  type Pco,
  type PcoCreate,
  type PcoPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

function dataDir(): string {
  return process.env.PCOS_DATA_DIR ?? path.resolve(process.cwd(), 'data', 'pcos');
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

async function readIndex(): Promise<Pco[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = PcoSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((p): p is Pco => p !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: Pco[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function createPco(
  input: PcoCreate,
  ctx?: AuditContext,
): Promise<Pco> {
  await ensureDir();
  const now = new Date().toISOString();
  const id = newPcoId();
  const p: Pco = {
    id,
    createdAt: now,
    updatedAt: now,
    origin: input.origin ?? 'OTHER',
    status: input.status ?? 'DRAFT',
    costImpactCents: input.costImpactCents ?? 0,
    scheduleImpactDays: input.scheduleImpactDays ?? 0,
    ...input,
  };
  PcoSchema.parse(p);
  await fs.writeFile(rowPath(id), JSON.stringify(p, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(p);
  await writeIndex(index);
  await recordAudit({
    action: 'create',
    entityType: 'Pco',
    entityId: id,
    after: p,
    ctx,
  });
  return p;
}

export async function listPcos(filter?: {
  jobId?: string;
  status?: string;
}): Promise<Pco[]> {
  let all = await readIndex();
  if (filter?.jobId) all = all.filter((p) => p.jobId === filter.jobId);
  if (filter?.status) all = all.filter((p) => p.status === filter.status);
  all.sort((a, b) => b.noticedOn.localeCompare(a.noticedOn));
  return all;
}

export async function getPco(id: string): Promise<Pco | null> {
  if (!/^pco-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return PcoSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function updatePco(
  id: string,
  patch: PcoPatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'submit' | 'approve' | 'reject' = 'update',
): Promise<Pco | null> {
  const existing = await getPco(id);
  if (!existing) return null;
  const updated: Pco = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  PcoSchema.parse(updated);
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
    entityType: 'Pco',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
