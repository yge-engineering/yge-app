// Postgres-backed store for PCOs.

import { prisma } from '@yge/db';
import {
  PcoSchema,
  newPcoId,
  type Pco,
  type PcoCreate,
  type PcoPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

function row2pco(row: { data: unknown }): Pco {
  return PcoSchema.parse(row.data);
}

export async function createPco(
  input: PcoCreate,
  ctx?: AuditContext,
): Promise<Pco> {
  const now = new Date().toISOString();
  const id = newPcoId();
  const p: Pco = {
    id,
    createdAt: now,
    updatedAt: now,
    origin: input.origin ?? 'OTHER',
    status: input.status ?? 'DRAFT',
    costImpactCents: input.costImpactCents ?? 0,
    scheduleImpactDays: input.scheduleImpactDays ?? 0,
    ...input,
  };
  PcoSchema.parse(p);
  await prisma.pco.create({
    data: {
      id,
      companyId: DEFAULT_COMPANY_ID,
      jobId: p.jobId,
      data: p as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'Pco',
    entityId: id,
    after: p,
    ctx,
  });
  return p;
}

export async function listPcos(filter?: {
  jobId?: string;
  status?: string;
}): Promise<Pco[]> {
  const rows = await prisma.pco.findMany({
    where: {
      companyId: DEFAULT_COMPANY_ID,
      deletedAt: null,
      ...(filter?.jobId ? { jobId: filter.jobId } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  let all = rows.map(row2pco);
  if (filter?.status) all = all.filter((p) => p.status === filter.status);
  return all;
}

export async function getPco(id: string): Promise<Pco | null> {
  if (!/^pco-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.pco.findFirst({
    where: { id, companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  return row ? row2pco(row) : null;
}

export async function updatePco(
  id: string,
  patch: PcoPatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'submit' | 'approve' | 'reject' = 'update',
): Promise<Pco | null> {
  const existing = await getPco(id);
  if (!existing) return null;
  const updated: Pco = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  PcoSchema.parse(updated);
  await prisma.pco.update({
    where: { id },
    data: { jobId: updated.jobId, data: updated as unknown as object },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'Pco',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
