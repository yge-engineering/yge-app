// Postgres-backed store for RFIs.

import { prisma } from '@yge/db';
import {
  RfiSchema,
  newRfiId,
  type Rfi,
  type RfiCreate,
  type RfiPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';
import { getRequestCompanyId } from './request-context';

const FALLBACK_COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
function companyId(): string {
  return getRequestCompanyId() ?? FALLBACK_COMPANY_ID;
}

function row2rfi(row: { data: unknown }): Rfi {
  return RfiSchema.parse(row.data);
}

export async function createRfi(
  input: RfiCreate,
  ctx?: AuditContext,
): Promise<Rfi> {
  const now = new Date().toISOString();
  const id = newRfiId();
  const r: Rfi = {
    id,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'DRAFT',
    priority: input.priority ?? 'MEDIUM',
    question: input.question ?? '',
    costImpact: input.costImpact ?? false,
    scheduleImpact: input.scheduleImpact ?? false,
    ...input,
  };
  RfiSchema.parse(r);
  await prisma.rfi.create({
    data: {
      id,
      companyId: companyId(),
      jobId: r.jobId,
      data: r as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'Rfi',
    entityId: id,
    after: r,
    ctx,
  });
  return r;
}

export async function listRfis(filter?: { jobId?: string; status?: string }): Promise<Rfi[]> {
  const rows = await prisma.rfi.findMany({
    where: {
      companyId: companyId(),
      deletedAt: null,
      ...(filter?.jobId ? { jobId: filter.jobId } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  let all = rows.map(row2rfi);
  if (filter?.status) all = all.filter((r) => r.status === filter.status);
  return all;
}

export async function getRfi(id: string): Promise<Rfi | null> {
  if (!/^rfi-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.rfi.findFirst({
    where: { id, companyId: companyId(), deletedAt: null },
  });
  return row ? row2rfi(row) : null;
}

export async function updateRfi(
  id: string,
  patch: RfiPatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'submit' | 'answer' = 'update',
): Promise<Rfi | null> {
  const existing = await getRfi(id);
  if (!existing) return null;
  const updated: Rfi = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  RfiSchema.parse(updated);
  await prisma.rfi.update({
    where: { id },
    data: { jobId: updated.jobId, data: updated as unknown as object },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'Rfi',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
