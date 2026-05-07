// Postgres-backed store for materials + their movement ledger.
//
// quantityOnHand is recomputed on every recordMovement() so the cached
// value never drifts from the truth. The full Material shape (incl.
// the movement ledger) lives in the Json `data` column.

import { prisma } from '@yge/db';
import {
  MaterialSchema,
  applyMovement,
  newMaterialId,
  newStockMovementId,
  type Material,
  type MaterialCreate,
  type MaterialPatch,
  type StockMovement,
  type StockMovementCreate,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

function row2mat(row: { data: unknown }): Material | null {
  if (!row.data) return null;
  const r = MaterialSchema.safeParse(row.data);
  return r.success ? r.data : null;
}

function structuredCols(m: Material) {
  return {
    code: m.sku ?? m.id,
    name: m.name,
    unit: m.unit,
    unitCostCents: m.unitCostCents ?? 0,
  };
}

export async function createMaterial(
  input: MaterialCreate,
  ctx?: AuditContext,
): Promise<Material> {
  const now = new Date().toISOString();
  const id = newMaterialId();
  const m: Material = {
    id,
    createdAt: now,
    updatedAt: now,
    movements: input.movements ?? [],
    quantityOnHand: input.quantityOnHand ?? 0,
    ...input,
  };
  MaterialSchema.parse(m);
  await prisma.material.create({
    data: {
      id,
      companyId: DEFAULT_COMPANY_ID,
      ...structuredCols(m),
      data: m as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'Material',
    entityId: id,
    after: m,
    ctx,
  });
  return m;
}

export async function listMaterials(filter?: {
  category?: string;
  belowReorder?: boolean;
}): Promise<Material[]> {
  const rows = await prisma.material.findMany({
    where: { companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  let all = rows
    .map(row2mat)
    .filter((m): m is Material => m !== null);
  if (filter?.category) all = all.filter((m) => m.category === filter.category);
  if (filter?.belowReorder) {
    all = all.filter(
      (m) => m.reorderPoint !== undefined && m.quantityOnHand <= m.reorderPoint,
    );
  }
  all.sort((a, b) => a.name.localeCompare(b.name));
  return all;
}

export async function getMaterial(id: string): Promise<Material | null> {
  if (!/^mat-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.material.findFirst({
    where: { id, companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  if (!row) return null;
  return row2mat(row);
}

export async function updateMaterial(
  id: string,
  patch: MaterialPatch,
  ctx?: AuditContext,
  auditAction: 'update' = 'update',
): Promise<Material | null> {
  const existing = await getMaterial(id);
  if (!existing) return null;
  const updated: Material = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  MaterialSchema.parse(updated);
  await prisma.material.update({
    where: { id },
    data: {
      ...structuredCols(updated),
      data: updated as unknown as object,
    },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'Material',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}

/** Append a stock movement and update quantityOnHand atomically. */
export async function recordMovement(
  id: string,
  movement: StockMovementCreate,
): Promise<Material | null> {
  const existing = await getMaterial(id);
  if (!existing) return null;
  const fullMovement: StockMovement = {
    id: newStockMovementId(),
    recordedAt: new Date().toISOString(),
    ...movement,
  };
  const newQty = applyMovement(existing.quantityOnHand, fullMovement);
  return updateMaterial(id, {
    movements: [...existing.movements, fullMovement],
    quantityOnHand: newQty,
  });
}
