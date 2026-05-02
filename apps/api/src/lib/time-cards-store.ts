// Every mutation here records an audit event via recordAudit() —
// CLAUDE.md mandates 'every mutation is audit-logged'.
//
// File-based store for weekly time cards.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  TimeCardSchema,
  newTimeCardId,
  type TimeCard,
  type TimeCardCreate,
  type TimeCardPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

function dataDir(): string {
  return (
    process.env.TIME_CARDS_DATA_DIR ??
    path.resolve(process.cwd(), 'data', 'time-cards')
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

async function readIndex(): Promise<TimeCard[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = TimeCardSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((c): c is TimeCard => c !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: TimeCard[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function createTimeCard(
  input: TimeCardCreate,
  ctx?: AuditContext,
): Promise<TimeCard> {
  await ensureDir();
  const now = new Date().toISOString();
  const id = newTimeCardId();
  const c: TimeCard = {
    id,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'DRAFT',
    entries: input.entries ?? [],
    ...input,
  };
  TimeCardSchema.parse(c);
  await fs.writeFile(rowPath(id), JSON.stringify(c, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(c);
  await writeIndex(index);
  await recordAudit({
    action: 'create',
    entityType: 'TimeCard',
    entityId: id,
    after: c,
    ctx,
  });
  return c;
}

export async function listTimeCards(filter?: {
  employeeId?: string;
  weekStarting?: string;
  status?: string;
}): Promise<TimeCard[]> {
  let all = await readIndex();
  if (filter?.employeeId) all = all.filter((c) => c.employeeId === filter.employeeId);
  if (filter?.weekStarting) all = all.filter((c) => c.weekStarting === filter.weekStarting);
  if (filter?.status) all = all.filter((c) => c.status === filter.status);
  all.sort((a, b) => b.weekStarting.localeCompare(a.weekStarting));
  return all;
}

export async function getTimeCard(id: string): Promise<TimeCard | null> {
  if (!/^tc-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return TimeCardSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function updateTimeCard(
  id: string,
  patch: TimeCardPatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'submit' | 'approve' | 'reject' | 'post' = 'update',
): Promise<TimeCard | null> {
  const existing = await getTimeCard(id);
  if (!existing) return null;
  const updated: TimeCard = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  TimeCardSchema.parse(updated);
  await fs.writeFile(rowPath(id), JSON.stringify(updated, null, 2), 'utf8');
  const index = await readIndex();
  const idx = index.findIndex((c) => c.id === id);
  if (idx >= 0) {
    index[idx] = updated;
  } else {
    index.unshift(updated);
  }
  await writeIndex(index);
  await recordAudit({
    action: auditAction,
    entityType: 'TimeCard',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
