// Postgres-backed store for plan takeoffs (PDF measurement records).

import { prisma } from '@yge/db';
import {
  PlanTakeoffSchema,
  newPlanTakeoffId,
  type PlanTakeoff,
  type PlanTakeoffCreate,
  type PlanTakeoffPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';
import { getRequestCompanyId } from './request-context';

const FALLBACK_COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
function companyId(): string {
  return getRequestCompanyId() ?? FALLBACK_COMPANY_ID;
}

function row2takeoff(row: { data: unknown }): PlanTakeoff {
  return PlanTakeoffSchema.parse(row.data);
}

export async function createPlanTakeoff(
  input: PlanTakeoffCreate,
  ctx?: AuditContext,
): Promise<PlanTakeoff> {
  const now = new Date().toISOString();
  const id = newPlanTakeoffId();
  const takeoff: PlanTakeoff = {
    id,
    createdAt: now,
    updatedAt: now,
    ...input,
    sheets: input.sheets ?? [],
  };
  PlanTakeoffSchema.parse(takeoff);
  await prisma.planTakeoff.create({
    data: {
      id,
      companyId: companyId(),
      jobId: takeoff.jobId ?? null,
      bidId: takeoff.bidId ?? null,
      planRef: takeoff.planRef,
      data: takeoff as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'PlanTakeoff',
    entityId: id,
    after: takeoff,
    ctx,
  });
  return takeoff;
}

export async function listPlanTakeoffs(filter?: {
  jobId?: string;
  bidId?: string;
  planRef?: string;
}): Promise<PlanTakeoff[]> {
  const rows = await prisma.planTakeoff.findMany({
    where: {
      companyId: companyId(),
      deletedAt: null,
      ...(filter?.jobId ? { jobId: filter.jobId } : {}),
      ...(filter?.bidId ? { bidId: filter.bidId } : {}),
      ...(filter?.planRef ? { planRef: filter.planRef } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(row2takeoff);
}

export async function getPlanTakeoff(id: string): Promise<PlanTakeoff | null> {
  if (!/^pt-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.planTakeoff.findFirst({
    where: { id, companyId: companyId(), deletedAt: null },
  });
  return row ? row2takeoff(row) : null;
}

export async function updatePlanTakeoff(
  id: string,
  patch: PlanTakeoffPatch,
  ctx?: AuditContext,
  auditAction: 'update' = 'update',
): Promise<PlanTakeoff | null> {
  const existing = await getPlanTakeoff(id);
  if (!existing) return null;
  const updated: PlanTakeoff = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
    // Patch is a partial — re-merge sheets if provided, else keep existing.
    sheets: patch.sheets ?? existing.sheets,
  };
  PlanTakeoffSchema.parse(updated);
  await prisma.planTakeoff.update({
    where: { id },
    data: {
      jobId: updated.jobId ?? null,
      bidId: updated.bidId ?? null,
      planRef: updated.planRef,
      data: updated as unknown as object,
    },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'PlanTakeoff',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
