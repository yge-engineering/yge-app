// Postgres-backed store for equipment rates.

import { prisma } from '@yge/db';
import {
  EquipmentRateSchema,
  newEquipmentRateId,
  type EquipmentRate,
  type EquipmentRateCreate,
  type EquipmentRatePatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

function row2er(row: { data: unknown }): EquipmentRate | null {
  if (!row.data) return null;
  const r = EquipmentRateSchema.safeParse(row.data);
  return r.success ? r.data : null;
}

function hourlyCentsOf(r: EquipmentRate): number {
  return r.totalCentsPerHour ?? r.bareRateCents ?? 0;
}

export async function listEquipmentRates(
  filter: { kind?: 'OWNED' | 'RENTAL' } = {},
): Promise<EquipmentRate[]> {
  const rows = await prisma.equipmentRate.findMany({
    where: { companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  return rows
    .map(row2er)
    .filter((r): r is EquipmentRate => r !== null)
    .filter((r) => !filter.kind || r.kind === filter.kind)
    .sort((a, b) => a.costCode.localeCompare(b.costCode));
}

export async function getEquipmentRate(id: string): Promise<EquipmentRate | null> {
  if (!/^er-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.equipmentRate.findFirst({
    where: { id, companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  if (!row) return null;
  return row2er(row);
}

export async function createEquipmentRate(
  input: EquipmentRateCreate,
  ctx: AuditContext = { actorUserId: null, reason: null },
): Promise<EquipmentRate> {
  const now = new Date().toISOString();
  const id = newEquipmentRateId();
  const row: EquipmentRate = EquipmentRateSchema.parse({
    ...input,
    id,
    createdAt: now,
    updatedAt: now,
  });
  await prisma.equipmentRate.create({
    data: {
      id,
      companyId: DEFAULT_COMPANY_ID,
      code: row.costCode,
      name: row.name,
      hourlyCents: hourlyCentsOf(row),
      data: row as unknown as object,
    },
  });
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
  const merged: EquipmentRate = EquipmentRateSchema.parse({
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  });
  await prisma.equipmentRate.update({
    where: { id },
    data: {
      code: merged.costCode,
      name: merged.name,
      hourlyCents: hourlyCentsOf(merged),
      data: merged as unknown as object,
    },
  });
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
  await prisma.equipmentRate.delete({ where: { id } });
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
