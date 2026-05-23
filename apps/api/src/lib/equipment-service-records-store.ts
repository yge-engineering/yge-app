import { prisma } from '@yge/db';
import {
  EquipmentServiceRecordSchema,
  newServiceRecordId,
  type EquipmentServiceRecord,
  type EquipmentServiceRecordCreate,
  type EquipmentServiceRecordPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';
import { getRequestCompanyId } from './request-context';

const FALLBACK_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
function companyId(): string {
  return getRequestCompanyId() ?? FALLBACK_COMPANY_ID;
}

function row2record(row: { data: unknown }): EquipmentServiceRecord {
  return EquipmentServiceRecordSchema.parse(row.data);
}

export async function createServiceRecord(
  input: EquipmentServiceRecordCreate,
  ctx?: AuditContext,
): Promise<EquipmentServiceRecord> {
  const now = new Date().toISOString();
  const id = newServiceRecordId();
  const record: EquipmentServiceRecord = {
    id,
    createdAt: now,
    updatedAt: now,
    ...input,
    status: input.status ?? 'OPEN',
    priority: input.priority ?? 'MEDIUM',
    category: input.category ?? 'OTHER',
    parts: input.parts ?? [],
    laborHours: input.laborHours ?? 0,
    laborRateCentsPerHour: input.laborRateCentsPerHour ?? 0,
    redTagged: input.redTagged ?? false,
    photoRefs: input.photoRefs ?? [],
  };
  EquipmentServiceRecordSchema.parse(record);
  await prisma.equipmentServiceRecord.create({
    data: {
      id,
      companyId: companyId(),
      equipmentId: record.equipmentId,
      status: record.status,
      priority: record.priority,
      redTagged: record.redTagged,
      data: record as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'EquipmentServiceRecord',
    entityId: id,
    after: record,
    ctx,
  });
  return record;
}

export async function listServiceRecords(filter?: {
  equipmentId?: string;
  status?: string;
  redTagged?: boolean;
}): Promise<EquipmentServiceRecord[]> {
  const rows = await prisma.equipmentServiceRecord.findMany({
    where: {
      companyId: companyId(),
      deletedAt: null,
      ...(filter?.equipmentId ? { equipmentId: filter.equipmentId } : {}),
      ...(filter?.status ? { status: filter.status } : {}),
      ...(typeof filter?.redTagged === 'boolean' ? { redTagged: filter.redTagged } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(row2record);
}

export async function getServiceRecord(id: string): Promise<EquipmentServiceRecord | null> {
  if (!/^wo-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.equipmentServiceRecord.findFirst({
    where: { id, companyId: companyId(), deletedAt: null },
  });
  return row ? row2record(row) : null;
}

export async function updateServiceRecord(
  id: string,
  patch: EquipmentServiceRecordPatch,
  ctx?: AuditContext,
  auditAction: 'update' = 'update',
): Promise<EquipmentServiceRecord | null> {
  const existing = await getServiceRecord(id);
  if (!existing) return null;
  const updated: EquipmentServiceRecord = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
    parts: patch.parts ?? existing.parts,
    photoRefs: patch.photoRefs ?? existing.photoRefs,
  };
  EquipmentServiceRecordSchema.parse(updated);
  await prisma.equipmentServiceRecord.update({
    where: { id },
    data: {
      equipmentId: updated.equipmentId,
      status: updated.status,
      priority: updated.priority,
      redTagged: updated.redTagged,
      data: updated as unknown as object,
    },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'EquipmentServiceRecord',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
