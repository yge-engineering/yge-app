// Equipment rates master store — owned (hourly + fuel) + rental
// (daily/weekly/monthly).

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  EquipmentRateSchema,
  newEquipmentRateId,
  type EquipmentRate,
  type EquipmentRateCreate,
  type EquipmentRatePatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

function dataDir(): string {
  return process.env.EQUIPMENT_RATES_DATA_DIR ?? path.resolve(process.cwd(), 'data', 'equipment-rates');
}
function indexPath(): string { return path.join(dataDir(), 'index.json'); }
function rowPath(id: string): string { return path.join(dataDir(), `${id}.json`); }

async function ensureDir() { await fs.mkdir(dataDir(), { recursive: true }); }

async function readIndex(): Promise<EquipmentRate[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((e: unknown) => EquipmentRateSchema.safeParse(e))
      .filter((r) => r.success)
      .map((r) => (r as { success: true; data: EquipmentRate }).data);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}
async function writeIndex(rows: EquipmentRate[]) {
  await fs.writeFile(indexPath(), JSON.stringify(rows, null, 2), 'utf8');
}

export async function listEquipmentRates(filter: { kind?: 'OWNED' | 'RENTAL' } = {}): Promise<EquipmentRate[]> {
  await ensureDir();
  const rows = await readIndex();
  return rows
    .filter((r) => !filter.kind || r.kind === filter.kind)
    .sort((a, b) => a.costCode.localeCompare(b.costCode));
}

export async function getEquipmentRate(id: string): Promise<EquipmentRate | null> {
  await ensureDir();
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    const r = EquipmentRateSchema.safeParse(JSON.parse(raw));
    return r.success ? r.data : null;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function createEquipmentRate(
  input: EquipmentRateCreate,
  ctx: AuditContext = { actorUserId: null, reason: null },
): Promise<EquipmentRate> {
  await ensureDir();
  const now = new Date().toISOString();
  const row = EquipmentRateSchema.parse({
    ...input,
    id: newEquipmentRateId(),
    createdAt: now,
    updatedAt: now,
  });
  await fs.writeFile(rowPath(row.id), JSON.stringify(row, null, 2), 'utf8');
  const idx = await readIndex();
  idx.push(row);
  await writeIndex(idx);
  await recordAudit({
    entityType: 'EquipmentRateMaster',
    entityId: row.id,
    action: 'create',
    before: null,
    after: row,
    ctx,
  });
  return row;
}

export async function updateEquipmentRate(
  id: string,
  patch: EquipmentRatePatch,
  ctx: AuditContext = { actorUserId: null, reason: null },
): Promise<EquipmentRate | null> {
  const existing = await getEquipmentRate(id);
  if (!existing) return null;
  const merged = EquipmentRateSchema.parse({
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
    entityType: 'EquipmentRateMaster',
    entityId: id,
    action: 'update',
    before: existing,
    after: merged,
    ctx,
  });
  return merged;
}

export async function deleteEquipmentRate(
  id: string,
  ctx: AuditContext = { actorUserId: null, reason: null },
): Promise<boolean> {
  const existing = await getEquipmentRate(id);
  if (!existing) return false;
  await fs.unlink(rowPath(id)).catch(() => undefined);
  const idx = await readIndex();
  await writeIndex(idx.filter((r) => r.id !== id));
  await recordAudit({
    entityType: 'EquipmentRateMaster',
    entityId: id,
    action: 'delete',
    before: existing,
    after: null,
    ctx,
  });
  return true;
}
