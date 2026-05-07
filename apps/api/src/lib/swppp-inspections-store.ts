// Postgres-backed store for SWPPP inspections.

import { prisma } from '@yge/db';
import {
  SwpppInspectionSchema,
  newSwpppInspectionId,
  type SwpppInspection,
  type SwpppInspectionCreate,
  type SwpppInspectionPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

function row2swp(row: { data: unknown }): SwpppInspection {
  return SwpppInspectionSchema.parse(row.data);
}

export async function createSwpppInspection(
  input: SwpppInspectionCreate,
  ctx?: AuditContext,
): Promise<SwpppInspection> {
  const now = new Date().toISOString();
  const id = newSwpppInspectionId();
  const s: SwpppInspection = {
    id,
    createdAt: now,
    updatedAt: now,
    trigger: input.trigger ?? 'WEEKLY',
    rainForecast: input.rainForecast ?? false,
    qualifyingRainEvent: input.qualifyingRainEvent ?? false,
    dischargeOccurred: input.dischargeOccurred ?? false,
    bmpChecks: input.bmpChecks ?? [],
    ...input,
  };
  SwpppInspectionSchema.parse(s);
  await prisma.swpppInspection.create({
    data: {
      id,
      companyId: DEFAULT_COMPANY_ID,
      jobId: s.jobId,
      inspectedAt: s.inspectedOn,
      data: s as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'SwpppInspection',
    entityId: id,
    after: s,
    ctx,
  });
  return s;
}

export async function listSwpppInspections(filter?: { jobId?: string }): Promise<SwpppInspection[]> {
  const rows = await prisma.swpppInspection.findMany({
    where: {
      companyId: DEFAULT_COMPANY_ID,
      deletedAt: null,
      ...(filter?.jobId ? { jobId: filter.jobId } : {}),
    },
    orderBy: { inspectedAt: 'desc' },
  });
  return rows.map(row2swp);
}

export async function getSwpppInspection(id: string): Promise<SwpppInspection | null> {
  if (!/^swp-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.swpppInspection.findFirst({
    where: { id, companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  return row ? row2swp(row) : null;
}

export async function updateSwpppInspection(
  id: string,
  patch: SwpppInspectionPatch,
  ctx?: AuditContext,
  auditAction: 'update' = 'update',
): Promise<SwpppInspection | null> {
  const existing = await getSwpppInspection(id);
  if (!existing) return null;
  const updated: SwpppInspection = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  SwpppInspectionSchema.parse(updated);
  await prisma.swpppInspection.update({
    where: { id },
    data: {
      jobId: updated.jobId,
      inspectedAt: updated.inspectedOn,
      data: updated as unknown as object,
    },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'SwpppInspection',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
