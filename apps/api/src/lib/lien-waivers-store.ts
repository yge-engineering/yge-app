// Postgres-backed store for lien waivers.

import { prisma } from '@yge/db';
import {
  LienWaiverSchema,
  newLienWaiverId,
  type LienWaiver,
  type LienWaiverCreate,
  type LienWaiverPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

function row2lw(row: { data: unknown }): LienWaiver {
  return LienWaiverSchema.parse(row.data);
}

export async function createLienWaiver(
  input: LienWaiverCreate,
  ctx?: AuditContext,
): Promise<LienWaiver> {
  const now = new Date().toISOString();
  const id = newLienWaiverId();
  const w: LienWaiver = {
    id,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'DRAFT',
    ...input,
  };
  LienWaiverSchema.parse(w);
  await prisma.lienWaiver.create({
    data: {
      id,
      companyId: DEFAULT_COMPANY_ID,
      jobId: w.jobId,
      data: w as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'LienWaiver',
    entityId: id,
    after: w,
    ctx,
  });
  return w;
}

export async function listLienWaivers(filter?: {
  jobId?: string;
  status?: string;
}): Promise<LienWaiver[]> {
  const rows = await prisma.lienWaiver.findMany({
    where: {
      companyId: DEFAULT_COMPANY_ID,
      deletedAt: null,
      ...(filter?.jobId ? { jobId: filter.jobId } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  let all = rows.map(row2lw);
  if (filter?.status) all = all.filter((w) => w.status === filter.status);
  return all;
}

export async function getLienWaiver(id: string): Promise<LienWaiver | null> {
  if (!/^lw-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.lienWaiver.findFirst({
    where: { id, companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  return row ? row2lw(row) : null;
}

export async function updateLienWaiver(
  id: string,
  patch: LienWaiverPatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'sign' | 'void' = 'update',
): Promise<LienWaiver | null> {
  const existing = await getLienWaiver(id);
  if (!existing) return null;
  const updated: LienWaiver = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  LienWaiverSchema.parse(updated);
  await prisma.lienWaiver.update({
    where: { id },
    data: { jobId: updated.jobId, data: updated as unknown as object },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'LienWaiver',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
