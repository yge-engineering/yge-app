// Postgres-backed store for equipment inspections.

import { prisma } from '@yge/db';
import {
  EquipmentInspectionSchema,
  newEquipmentInspectionId,
  type EquipmentInspection,
  type EquipmentInspectionCreate,
  type EquipmentInspectionPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';
import { getRequestCompanyId } from './request-context';

const FALLBACK_COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
function companyId(): string {
  return getRequestCompanyId() ?? FALLBACK_COMPANY_ID;
}

function row2inspection(row: { data: unknown }): EquipmentInspection {
  return EquipmentInspectionSchema.parse(row.data);
}

export async function createEquipmentInspection(
  input: EquipmentInspectionCreate,
  ctx?: AuditContext,
): Promise<EquipmentInspection> {
  const now = new Date().toISOString();
  const id = newEquipmentInspectionId();
  const inspection: EquipmentInspection = {
    id,
    createdAt: now,
    updatedAt: now,
    ...input,
    type: input.type ?? 'PRE_SHIFT',
    checks: input.checks ?? [],
    outOfService: input.outOfService ?? false,
    photoRefs: input.photoRefs ?? [],
  };
  EquipmentInspectionSchema.parse(inspection);
  await prisma.equipmentInspection.create({
    data: {
      id,
      companyId: companyId(),
      equipmentId: inspection.equipmentId,
      outOfService: inspection.outOfService,
      data: inspection as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'EquipmentInspection',
    entityId: id,
    after: inspection,
    ctx,
  });
  return inspection;
}

export async function listEquipmentInspections(filter?: {
  equipmentId?: string;
  jobId?: string;
  outOfService?: boolean;
}): Promise<EquipmentInspection[]> {
  const rows = await prisma.equipmentInspection.findMany({
    where: {
      companyId: companyId(),
      deletedAt: null,
      ...(filter?.equipmentId ? { equipmentId: filter.equipmentId } : {}),
      ...(typeof filter?.outOfService === 'boolean'
        ? { outOfService: filter.outOfService }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  let all = rows.map(row2inspection);
  if (filter?.jobId) all = all.filter((i) => i.jobId === filter.jobId);
  all.sort((a, b) => b.inspectedOn.localeCompare(a.inspectedOn));
  return all;
}

export async function getEquipmentInspection(
  id: string,
): Promise<EquipmentInspection | null> {
  if (!/^ei-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.equipmentInspection.findFirst({
    where: { id, companyId: companyId(), deletedAt: null },
  });
  return row ? row2inspection(row) : null;
}

export async function updateEquipmentInspection(
  id: string,
  patch: EquipmentInspectionPatch,
  ctx?: AuditContext,
  auditAction: 'update' = 'update',
): Promise<EquipmentInspection | null> {
  const existing = await getEquipmentInspection(id);
  if (!existing) return null;
  const updated: EquipmentInspection = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  EquipmentInspectionSchema.parse(updated);
  await prisma.equipmentInspection.update({
    where: { id },
    data: {
      equipmentId: updated.equipmentId,
      outOfService: updated.outOfService,
      data: updated as unknown as object,
    },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'EquipmentInspection',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
