// Postgres-backed store for DIR prevailing wage rates.

import { prisma } from '@yge/db';
import {
  DirRateSchema,
  newDirRateId,
  type DirRate,
  type DirRateCreate,
  type DirRatePatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';
import { getRequestCompanyId } from './request-context';

const FALLBACK_COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
function companyId(): string {
  return getRequestCompanyId() ?? FALLBACK_COMPANY_ID;
}

function row2rate(row: { data: unknown }): DirRate {
  return DirRateSchema.parse(row.data);
}

export async function createDirRate(
  input: DirRateCreate,
  ctx?: AuditContext,
): Promise<DirRate> {
  const now = new Date().toISOString();
  const id = newDirRateId();
  const r: DirRate = {
    id,
    createdAt: now,
    updatedAt: now,
    healthAndWelfareCents: input.healthAndWelfareCents ?? 0,
    pensionCents: input.pensionCents ?? 0,
    vacationHolidayCents: input.vacationHolidayCents ?? 0,
    trainingCents: input.trainingCents ?? 0,
    otherFringeCents: input.otherFringeCents ?? 0,
    ...input,
  };
  DirRateSchema.parse(r);
  await prisma.dirRate.create({
    data: {
      id,
      companyId: companyId(),
      craft: r.classification,
      effectiveOn: r.effectiveDate,
      data: r as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'DirRateSchedule',
    entityId: id,
    after: r,
    ctx,
  });
  return r;
}

export async function listDirRates(filter?: {
  classification?: string;
  county?: string;
}): Promise<DirRate[]> {
  const rows = await prisma.dirRate.findMany({
    where: {
      companyId: companyId(),
      deletedAt: null,
      ...(filter?.classification ? { craft: filter.classification } : {}),
    },
    orderBy: [{ craft: 'asc' }, { effectiveOn: 'desc' }],
  });
  let all = rows.map(row2rate);
  if (filter?.county) all = all.filter((r) => r.county === filter.county);
  return all;
}

export async function getDirRate(id: string): Promise<DirRate | null> {
  if (!/^dir-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.dirRate.findFirst({
    where: { id, companyId: companyId(), deletedAt: null },
  });
  return row ? row2rate(row) : null;
}

export async function updateDirRate(
  id: string,
  patch: DirRatePatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'import' = 'update',
): Promise<DirRate | null> {
  const existing = await getDirRate(id);
  if (!existing) return null;
  const updated: DirRate = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  DirRateSchema.parse(updated);
  await prisma.dirRate.update({
    where: { id },
    data: {
      craft: updated.classification,
      effectiveOn: updated.effectiveDate,
      data: updated as unknown as object,
    },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'DirRateSchedule',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
