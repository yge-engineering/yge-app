// File-based store for legal holds.
//
// Every mutation here records an audit event. Legal-hold creation
// + release is exactly the kind of action that lands on the
// auditor's desk later — the full audit trail (who, when, why,
// from where) is the proof YGE complied with the discovery /
// preservation request.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  LegalHoldSchema,
  newLegalHoldId,
  type LegalHold,
  type LegalHoldCreate,
  type LegalHoldStatus,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

function dataDir(): string {
  return (
    process.env.LEGAL_HOLDS_DATA_DIR ??
    path.resolve(process.cwd(), 'data', 'legal-holds')
  );
}
function indexPath(): string { return path.join(dataDir(), 'index.json'); }
function rowPath(id: string): string { return path.join(dataDir(), `${id}.json`); }

async function ensureDir() { await fs.mkdir(dataDir(), { recursive: true }); }

async function readIndex(): Promise<LegalHold[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const r = LegalHoldSchema.safeParse(entry);
        return r.success ? r.data : null;
      })
      .filter((h): h is LegalHold => h !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(rows: LegalHold[]) {
  await fs.writeFile(indexPath(), JSON.stringify(rows, null, 2), 'utf8');
}

async function persist(h: LegalHold) {
  await ensureDir();
  await fs.writeFile(rowPath(h.id), JSON.stringify(h, null, 2), 'utf8');
  const index = await readIndex();
  const at = index.findIndex((row) => row.id === h.id);
  if (at >= 0) index[at] = h;
  else index.unshift(h);
  await writeIndex(index);
}

export interface LegalHoldFilter {
  status?: LegalHoldStatus;
}

export async function listLegalHolds(filter: LegalHoldFilter = {}): Promise<LegalHold[]> {
  let rows = await readIndex();
  if (filter.status) rows = rows.filter((h) => h.status === filter.status);
  return rows;
}

export async function getLegalHold(id: string): Promise<LegalHold | null> {
  if (!/^hold-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return LegalHoldSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function createLegalHold(
  input: LegalHoldCreate,
  ctx?: AuditContext,
): Promise<LegalHold> {
  const now = new Date().toISOString();
  const id = newLegalHoldId();
  const h: LegalHold = LegalHoldSchema.parse({
    id,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'ACTIVE',
    ...input,
  });
  await persist(h);
  await recordAudit({
    action: 'create',
    entityType: 'Document',
    entityId: id,
    after: h,
    ctx,
  });
  // Also drop an audit row against EVERY frozen entity so the
  // per-record binder shows the freeze.
  for (const e of h.entities) {
    await recordAudit({
      action: 'archive',
      entityType: e.entityType,
      entityId: e.entityId,
      after: { holdId: h.id, holdTitle: h.title, holdReason: h.reason },
      ctx: { ...ctx, reason: `Legal hold ${h.id}: ${h.reason}` },
    });
  }
  return h;
}

export async function releaseLegalHold(
  id: string,
  releasedByUserId: string | null,
  releasedReason: string,
  ctx?: AuditContext,
): Promise<LegalHold | null> {
  const existing = await getLegalHold(id);
  if (!existing) return null;
  if (existing.status !== 'ACTIVE') return existing;
  const now = new Date().toISOString();
  const updated: LegalHold = LegalHoldSchema.parse({
    ...existing,
    status: 'RELEASED',
    releasedAt: now,
    releasedByUserId: releasedByUserId ?? undefined,
    releasedReason,
    updatedAt: now,
  });
  await persist(updated);
  await recordAudit({
    action: 'restore',
    entityType: 'Document',
    entityId: id,
    before: existing,
    after: updated,
    ctx: { ...ctx, reason: releasedReason },
  });
  // Mirror the un-freeze on every frozen entity.
  for (const e of existing.entities) {
    await recordAudit({
      action: 'restore',
      entityType: e.entityType,
      entityId: e.entityId,
      after: { holdId: id, releasedAt: now },
      ctx: { ...ctx, reason: `Legal hold ${id} released: ${releasedReason}` },
    });
  }
  return updated;
}
