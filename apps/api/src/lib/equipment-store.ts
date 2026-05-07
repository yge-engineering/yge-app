// Postgres-backed store for equipment + vehicles.
//
// Dispatch helpers (assignEquipment / returnEquipment) keep status +
// assignment fields in lockstep so the UI never sees a half-state row.
// logMaintenance() pushes a new entry and updates lastServiceUsage in
// a single write.

import { prisma } from '@yge/db';
import {
  EquipmentSchema,
  newEquipmentId,
  type Equipment,
  type EquipmentCreate,
  type EquipmentPatch,
  type MaintenanceLogEntry,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

function row2eq(row: { data: unknown }): Equipment | null {
  const r = EquipmentSchema.safeParse(row.data);
  return r.success ? r.data : null;
}

function structuredCols(e: Equipment) {
  return {
    name: e.name,
    category: e.category,
    status: e.status,
    assignedJobId: e.assignedJobId ?? null,
  };
}

export async function createEquipment(
  input: EquipmentCreate,
  ctx?: AuditContext,
): Promise<Equipment> {
  const now = new Date().toISOString();
  const id = newEquipmentId();
  const e: Equipment = {
    id,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'IN_YARD',
    currentUsage: input.currentUsage ?? 0,
    maintenanceLog: input.maintenanceLog ?? [],
    ...input,
  };
  EquipmentSchema.parse(e);
  await prisma.equipment.create({
    data: {
      id,
      companyId: DEFAULT_COMPANY_ID,
      ...structuredCols(e),
      data: e as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'Equipment',
    entityId: id,
    after: e,
    ctx,
  });
  return e;
}

export async function listEquipment(): Promise<Equipment[]> {
  const rows = await prisma.equipment.findMany({
    where: { companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  return rows.map(row2eq).filter((e): e is Equipment => e !== null);
}

export async function getEquipment(id: string): Promise<Equipment | null> {
  if (!/^eq-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.equipment.findFirst({
    where: { id, companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  if (!row) return null;
  return row2eq(row);
}

export async function updateEquipment(
  id: string,
  patch: EquipmentPatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'archive' = 'update',
): Promise<Equipment | null> {
  const existing = await getEquipment(id);
  if (!existing) return null;
  const updated: Equipment = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  EquipmentSchema.parse(updated);
  await prisma.equipment.update({
    where: { id },
    data: {
      ...structuredCols(updated),
      data: updated as unknown as object,
    },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'Equipment',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}

/** Assign equipment to a job (and optionally an operator). */
export async function assignEquipment(
  id: string,
  jobId: string,
  operatorEmployeeId?: string,
): Promise<Equipment | null> {
  return updateEquipment(id, {
    status: 'ASSIGNED',
    assignedJobId: jobId,
    assignedOperatorEmployeeId: operatorEmployeeId,
    assignedAt: new Date().toISOString(),
  });
}

/** Return to yard / shop / repair, clearing the assignment fields. */
export async function returnEquipment(
  id: string,
  destination: 'IN_YARD' | 'IN_SERVICE' | 'OUT_FOR_REPAIR' = 'IN_YARD',
): Promise<Equipment | null> {
  return updateEquipment(id, {
    status: destination,
    assignedJobId: undefined,
    assignedOperatorEmployeeId: undefined,
    assignedAt: undefined,
  });
}

/** Append a maintenance log entry and roll lastServiceUsage forward. */
export async function logMaintenance(
  id: string,
  entry: MaintenanceLogEntry,
): Promise<Equipment | null> {
  const existing = await getEquipment(id);
  if (!existing) return null;
  const log = [...existing.maintenanceLog, entry];
  return updateEquipment(id, {
    maintenanceLog: log,
    lastServiceUsage: entry.usageAtService,
    currentUsage: Math.max(existing.currentUsage, entry.usageAtService),
  });
}
