// Postgres-backed store for dispatches.

import { prisma } from '@yge/db';
import {
  DispatchSchema,
  newDispatchId,
  type Dispatch,
  type DispatchCreate,
  type DispatchPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

function row2disp(row: { data: unknown }): Dispatch {
  return DispatchSchema.parse(row.data);
}

export async function createDispatch(
  input: DispatchCreate,
  ctx?: AuditContext,
): Promise<Dispatch> {
  const now = new Date().toISOString();
  const id = newDispatchId();
  const d: Dispatch = {
    id,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'DRAFT',
    crew: input.crew ?? [],
    equipment: input.equipment ?? [],
    ...input,
  };
  DispatchSchema.parse(d);
  await prisma.dispatch.create({
    data: {
      id,
      companyId: DEFAULT_COMPANY_ID,
      jobId: d.jobId,
      scheduledFor: d.scheduledFor,
      data: d as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'Dispatch',
    entityId: id,
    after: d,
    ctx,
  });
  return d;
}

export async function listDispatches(filter?: {
  jobId?: string;
  scheduledFor?: string;
  status?: string;
}): Promise<Dispatch[]> {
  const rows = await prisma.dispatch.findMany({
    where: {
      companyId: DEFAULT_COMPANY_ID,
      deletedAt: null,
      ...(filter?.jobId ? { jobId: filter.jobId } : {}),
      ...(filter?.scheduledFor ? { scheduledFor: filter.scheduledFor } : {}),
    },
    orderBy: { scheduledFor: 'desc' },
  });
  let all = rows.map(row2disp);
  if (filter?.status) all = all.filter((d) => d.status === filter.status);
  return all;
}

export async function getDispatch(id: string): Promise<Dispatch | null> {
  if (!/^disp-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.dispatch.findFirst({
    where: { id, companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  return row ? row2disp(row) : null;
}

export async function updateDispatch(
  id: string,
  patch: DispatchPatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'cancel' = 'update',
): Promise<Dispatch | null> {
  const existing = await getDispatch(id);
  if (!existing) return null;
  const updated: Dispatch = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  DispatchSchema.parse(updated);
  await prisma.dispatch.update({
    where: { id },
    data: {
      jobId: updated.jobId,
      scheduledFor: updated.scheduledFor,
      data: updated as unknown as object,
    },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'Dispatch',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
