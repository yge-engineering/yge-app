// Postgres-backed store for mileage entries.

import { prisma } from '@yge/db';
import {
  MileageEntrySchema,
  newMileageEntryId,
  type MileageEntry,
  type MileageEntryCreate,
  type MileageEntryPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

function row2mi(row: { data: unknown }): MileageEntry {
  return MileageEntrySchema.parse(row.data);
}

export async function createMileageEntry(
  input: MileageEntryCreate,
  ctx?: AuditContext,
): Promise<MileageEntry> {
  const now = new Date().toISOString();
  const id = newMileageEntryId();
  const e: MileageEntry = {
    id,
    createdAt: now,
    updatedAt: now,
    purpose: input.purpose ?? 'JOBSITE_TRAVEL',
    isPersonalVehicle: input.isPersonalVehicle ?? false,
    reimbursed: input.reimbursed ?? false,
    ...input,
  };
  MileageEntrySchema.parse(e);
  await prisma.mileage.create({
    data: {
      id,
      companyId: DEFAULT_COMPANY_ID,
      employeeId: e.employeeId,
      tripDate: e.tripDate,
      data: e as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'Mileage',
    entityId: id,
    after: e,
    ctx,
  });
  return e;
}

export async function listMileageEntries(filter?: {
  employeeId?: string;
  jobId?: string;
  reimbursed?: boolean;
}): Promise<MileageEntry[]> {
  const rows = await prisma.mileage.findMany({
    where: {
      companyId: DEFAULT_COMPANY_ID,
      deletedAt: null,
      ...(filter?.employeeId ? { employeeId: filter.employeeId } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  let all = rows.map(row2mi);
  if (filter?.jobId) all = all.filter((e) => e.jobId === filter.jobId);
  if (filter?.reimbursed !== undefined)
    all = all.filter((e) => e.reimbursed === filter.reimbursed);
  return all;
}

export async function getMileageEntry(id: string): Promise<MileageEntry | null> {
  if (!/^mi-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.mileage.findFirst({
    where: { id, companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  return row ? row2mi(row) : null;
}

export async function updateMileageEntry(
  id: string,
  patch: MileageEntryPatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'submit' | 'approve' | 'reject' = 'update',
): Promise<MileageEntry | null> {
  const existing = await getMileageEntry(id);
  if (!existing) return null;
  const updated: MileageEntry = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  MileageEntrySchema.parse(updated);
  await prisma.mileage.update({
    where: { id },
    data: {
      employeeId: updated.employeeId,
      tripDate: updated.tripDate,
      data: updated as unknown as object,
    },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'Mileage',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
