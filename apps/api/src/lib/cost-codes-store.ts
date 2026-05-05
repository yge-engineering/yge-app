// Cost codes master store — list + create + patch + delete.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  CostCodeSchema,
  newCostCodeId,
  type CostCode,
  type CostCodeCreate,
  type CostCodePatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

function dataDir(): string {
  return process.env.COST_CODES_DATA_DIR ?? path.resolve(process.cwd(), 'data', 'cost-codes');
}
function indexPath(): string { return path.join(dataDir(), 'index.json'); }
function rowPath(id: string): string { return path.join(dataDir(), `${id}.json`); }

async function ensureDir() { await fs.mkdir(dataDir(), { recursive: true }); }

async function readIndex(): Promise<CostCode[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((e: unknown) => CostCodeSchema.safeParse(e))
      .filter((r) => r.success)
      .map((r) => (r as { success: true; data: CostCode }).data);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}
async function writeIndex(rows: CostCode[]) {
  await fs.writeFile(indexPath(), JSON.stringify(rows, null, 2), 'utf8');
}

export async function listCostCodes(): Promise<CostCode[]> {
  await ensureDir();
  const rows = await readIndex();
  return rows.sort((a, b) => a.code.localeCompare(b.code));
}

export async function getCostCode(id: string): Promise<CostCode | null> {
  await ensureDir();
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    const r = CostCodeSchema.safeParse(JSON.parse(raw));
    return r.success ? r.data : null;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function createCostCode(
  input: CostCodeCreate,
  ctx: AuditContext = { actorUserId: null, reason: null },
): Promise<CostCode> {
  await ensureDir();
  const now = new Date().toISOString();
  const row: CostCode = CostCodeSchema.parse({
    ...input,
    id: newCostCodeId(),
    createdAt: now,
    updatedAt: now,
  });
  await fs.writeFile(rowPath(row.id), JSON.stringify(row, null, 2), 'utf8');
  const idx = await readIndex();
  idx.push(row);
  await writeIndex(idx);
  await recordAudit({
    entityType: 'CostCodeMaster',
    entityId: row.id,
    action: 'create',
    before: null,
    after: row,
    ctx,
  });
  return row;
}

export async function updateCostCode(
  id: string,
  patch: CostCodePatch,
  ctx: AuditContext = { actorUserId: null, reason: null },
): Promise<CostCode | null> {
  const existing = await getCostCode(id);
  if (!existing) return null;
  const merged = CostCodeSchema.parse({
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  });
  await fs.writeFile(rowPath(id), JSON.stringify(merged, null, 2), 'utf8');
  const idx = await readIndex();
  const i = idx.findIndex((r) => r.id === id);
  if (i >= 0) idx[i] = merged; else idx.push(merged);
  await writeIndex(idx);
  await recordAudit({
    entityType: 'CostCodeMaster',
    entityId: id,
    action: 'update',
    before: existing,
    after: merged,
    ctx,
  });
  return merged;
}

export async function deleteCostCode(
  id: string,
  ctx: AuditContext = { actorUserId: null, reason: null },
): Promise<boolean> {
  const existing = await getCostCode(id);
  if (!existing) return false;
  await fs.unlink(rowPath(id)).catch(() => undefined);
  const idx = await readIndex();
  await writeIndex(idx.filter((r) => r.id !== id));
  await recordAudit({
    entityType: 'CostCodeMaster',
    entityId: id,
    action: 'delete',
    before: existing,
    after: null,
    ctx,
  });
  return true;
}
