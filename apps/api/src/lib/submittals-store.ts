// Postgres-backed store for submittals.

import { prisma } from '@yge/db';
import {
  SubmittalSchema,
  newSubmittalId,
  type Submittal,
  type SubmittalCreate,
  type SubmittalPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

function row2sub(row: { data: unknown }): Submittal {
  return SubmittalSchema.parse(row.data);
}

export async function createSubmittal(
  input: SubmittalCreate,
  ctx?: AuditContext,
): Promise<Submittal> {
  const now = new Date().toISOString();
  const id = newSubmittalId();
  const s: Submittal = {
    id,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'DRAFT',
    blocksOrdering: input.blocksOrdering ?? false,
    ...input,
  };
  SubmittalSchema.parse(s);
  await prisma.submittal.create({
    data: {
      id,
      companyId: DEFAULT_COMPANY_ID,
      jobId: s.jobId,
      data: s as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'Submittal',
    entityId: id,
    after: s,
    ctx,
  });
  return s;
}

export async function listSubmittals(filter?: {
  jobId?: string;
  status?: string;
}): Promise<Submittal[]> {
  const rows = await prisma.submittal.findMany({
    where: {
      companyId: DEFAULT_COMPANY_ID,
      deletedAt: null,
      ...(filter?.jobId ? { jobId: filter.jobId } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  let all = rows.map(row2sub);
  if (filter?.status) all = all.filter((s) => s.status === filter.status);
  return all;
}

export async function getSubmittal(id: string): Promise<Submittal | null> {
  if (!/^subm-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.submittal.findFirst({
    where: { id, companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  return row ? row2sub(row) : null;
}

export async function updateSubmittal(
  id: string,
  patch: SubmittalPatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'submit' | 'approve' | 'reject' = 'update',
): Promise<Submittal | null> {
  const existing = await getSubmittal(id);
  if (!existing) return null;
  const updated: Submittal = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  SubmittalSchema.parse(updated);
  await prisma.submittal.update({
    where: { id },
    data: { jobId: updated.jobId, data: updated as unknown as object },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'Submittal',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
