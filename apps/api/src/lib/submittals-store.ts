// Every mutation here records an audit event via recordAudit() —
// CLAUDE.md mandates 'every mutation is audit-logged'.
//
// File-based store for submittals.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  SubmittalSchema,
  newSubmittalId,
  type Submittal,
  type SubmittalCreate,
  type SubmittalPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

function dataDir(): string {
  return (
    process.env.SUBMITTALS_DATA_DIR ??
    path.resolve(process.cwd(), 'data', 'submittals')
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

async function readIndex(): Promise<Submittal[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = SubmittalSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((s): s is Submittal => s !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: Submittal[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function createSubmittal(
  input: SubmittalCreate,
  ctx?: AuditContext,
): Promise<Submittal> {
  await ensureDir();
  const now = new Date().toISOString();
  const id = newSubmittalId();
  const s: Submittal = {
    id,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'DRAFT',
    blocksOrdering: input.blocksOrdering ?? false,
    ...input,
  };
  SubmittalSchema.parse(s);
  await fs.writeFile(rowPath(id), JSON.stringify(s, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(s);
  await writeIndex(index);
  await recordAudit({
    action: 'create',
    entityType: 'Submittal',
    entityId: id,
    after: s,
    ctx,
  });
  return s;
}

export async function listSubmittals(filter?: {
  jobId?: string;
  status?: string;
}): Promise<Submittal[]> {
  let all = await readIndex();
  if (filter?.jobId) all = all.filter((s) => s.jobId === filter.jobId);
  if (filter?.status) all = all.filter((s) => s.status === filter.status);
  all.sort((a, b) => {
    const av = a.submittedAt ?? a.createdAt.slice(0, 10);
    const bv = b.submittedAt ?? b.createdAt.slice(0, 10);
    return bv.localeCompare(av);
  });
  return all;
}

export async function getSubmittal(id: string): Promise<Submittal | null> {
  if (!/^subm-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return SubmittalSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function updateSubmittal(
  id: string,
  patch: SubmittalPatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'submit' | 'approve' | 'reject' = 'update',
): Promise<Submittal | null> {
  const existing = await getSubmittal(id);
  if (!existing) return null;
  const updated: Submittal = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  SubmittalSchema.parse(updated);
  await fs.writeFile(rowPath(id), JSON.stringify(updated, null, 2), 'utf8');
  const index = await readIndex();
  const idx = index.findIndex((s) => s.id === id);
  if (idx >= 0) {
    index[idx] = updated;
  } else {
    index.unshift(updated);
  }
  await writeIndex(index);
  await recordAudit({
    action: auditAction,
    entityType: 'Submittal',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
