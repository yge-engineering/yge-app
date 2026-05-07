// Postgres-backed store for cost codes.

import { prisma } from '@yge/db';
import {
  CostCodeSchema,
  newCostCodeId,
  type CostCode,
  type CostCodeCreate,
  type CostCodePatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

function row2cc(row: { data: unknown }): CostCode | null {
  if (!row.data) return null;
  const r = CostCodeSchema.safeParse(row.data);
  return r.success ? r.data : null;
}

export async function listCostCodes(): Promise<CostCode[]> {
  const rows = await prisma.costCode.findMany({
    where: { companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  return rows
    .map(row2cc)
    .filter((c): c is CostCode => c !== null)
    .sort((a, b) => a.code.localeCompare(b.code));
}

export async function getCostCode(id: string): Promise<CostCode | null> {
  if (!/^cc-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.costCode.findFirst({
    where: { id, companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  if (!row) return null;
  return row2cc(row);
}

export async function createCostCode(
  input: CostCodeCreate,
  ctx: AuditContext = { actorUserId: null, reason: null },
): Promise<CostCode> {
  const now = new Date().toISOString();
  const id = newCostCodeId();
  const row: CostCode = CostCodeSchema.parse({
    ...input,
    id,
    createdAt: now,
    updatedAt: now,
  });
  await prisma.costCode.create({
    data: {
      id,
      companyId: DEFAULT_COMPANY_ID,
      code: row.code,
      name: row.description ?? row.code,
      category: row.category ?? null,
      data: row as unknown as object,
    },
  });
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
  const merged: CostCode = CostCodeSchema.parse({
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  });
  await prisma.costCode.update({
    where: { id },
    data: {
      code: merged.code,
      name: merged.description ?? merged.code,
      category: merged.category ?? null,
      data: merged as unknown as object,
    },
  });
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
  await prisma.costCode.delete({ where: { id } });
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
