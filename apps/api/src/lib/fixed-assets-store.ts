import { prisma } from '@yge/db';
import {
  FixedAssetSchema,
  newFixedAssetId,
  type FixedAsset,
  type FixedAssetCreate,
  type FixedAssetPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';
import { getRequestCompanyId } from './request-context';

const FALLBACK_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
function companyId(): string {
  return getRequestCompanyId() ?? FALLBACK_COMPANY_ID;
}

function row2asset(row: { data: unknown }): FixedAsset {
  return FixedAssetSchema.parse(row.data);
}

export async function createFixedAsset(
  input: FixedAssetCreate,
  ctx?: AuditContext,
): Promise<FixedAsset> {
  const now = new Date().toISOString();
  const id = newFixedAssetId();
  const asset: FixedAsset = {
    id,
    createdAt: now,
    updatedAt: now,
    ...input,
  };
  FixedAssetSchema.parse(asset);
  await prisma.fixedAsset.create({
    data: {
      id,
      companyId: companyId(),
      category: asset.category,
      equipmentId: asset.equipmentId ?? null,
      data: asset as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'FixedAsset',
    entityId: id,
    after: asset,
    ctx,
  });
  return asset;
}

export async function listFixedAssets(filter?: {
  category?: string;
  equipmentId?: string;
}): Promise<FixedAsset[]> {
  const rows = await prisma.fixedAsset.findMany({
    where: {
      companyId: companyId(),
      deletedAt: null,
      ...(filter?.category ? { category: filter.category } : {}),
      ...(filter?.equipmentId ? { equipmentId: filter.equipmentId } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(row2asset);
}

export async function getFixedAsset(id: string): Promise<FixedAsset | null> {
  if (!/^fa-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.fixedAsset.findFirst({
    where: { id, companyId: companyId(), deletedAt: null },
  });
  return row ? row2asset(row) : null;
}

export async function updateFixedAsset(
  id: string,
  patch: FixedAssetPatch,
  ctx?: AuditContext,
  auditAction: 'update' = 'update',
): Promise<FixedAsset | null> {
  const existing = await getFixedAsset(id);
  if (!existing) return null;
  const updated: FixedAsset = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  FixedAssetSchema.parse(updated);
  await prisma.fixedAsset.update({
    where: { id },
    data: {
      category: updated.category,
      equipmentId: updated.equipmentId ?? null,
      data: updated as unknown as object,
    },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'FixedAsset',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
