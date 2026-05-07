// Postgres-backed store for change orders.

import { prisma } from '@yge/db';
import {
  ChangeOrderSchema,
  newChangeOrderId,
  recomputeChangeOrderTotals,
  type ChangeOrder,
  type ChangeOrderCreate,
  type ChangeOrderPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

function row2co(row: { data: unknown }): ChangeOrder {
  return ChangeOrderSchema.parse(row.data);
}

export async function createChangeOrder(
  input: ChangeOrderCreate,
  ctx?: AuditContext,
): Promise<ChangeOrder> {
  const now = new Date().toISOString();
  const id = newChangeOrderId();
  const lineItems = input.lineItems ?? [];
  const totals = recomputeChangeOrderTotals(lineItems);
  const c: ChangeOrder = {
    id,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'PROPOSED',
    reason: input.reason ?? 'OWNER_DIRECTED',
    description: input.description ?? '',
    lineItems,
    totalCostImpactCents: input.totalCostImpactCents ?? totals.totalCostImpactCents,
    totalScheduleImpactDays: input.totalScheduleImpactDays ?? totals.totalScheduleImpactDays,
    ...input,
  };
  ChangeOrderSchema.parse(c);
  await prisma.changeOrder.create({
    data: {
      id,
      companyId: DEFAULT_COMPANY_ID,
      jobId: c.jobId,
      data: c as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'ChangeOrder',
    entityId: id,
    after: c,
    ctx,
  });
  return c;
}

export async function listChangeOrders(filter?: {
  jobId?: string;
  status?: string;
}): Promise<ChangeOrder[]> {
  const rows = await prisma.changeOrder.findMany({
    where: {
      companyId: DEFAULT_COMPANY_ID,
      deletedAt: null,
      ...(filter?.jobId ? { jobId: filter.jobId } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  let all = rows.map(row2co);
  if (filter?.status) all = all.filter((c) => c.status === filter.status);
  return all;
}

export async function getChangeOrder(id: string): Promise<ChangeOrder | null> {
  if (!/^co-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.changeOrder.findFirst({
    where: { id, companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  return row ? row2co(row) : null;
}

export async function updateChangeOrder(
  id: string,
  patch: ChangeOrderPatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'submit' | 'approve' | 'reject' | 'void' = 'update',
): Promise<ChangeOrder | null> {
  const existing = await getChangeOrder(id);
  if (!existing) return null;
  const merged = { ...existing, ...patch };
  if (patch.lineItems !== undefined) {
    const totals = recomputeChangeOrderTotals(patch.lineItems);
    merged.totalCostImpactCents = totals.totalCostImpactCents;
    merged.totalScheduleImpactDays = totals.totalScheduleImpactDays;
  }
  const updated: ChangeOrder = {
    ...merged,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  ChangeOrderSchema.parse(updated);
  await prisma.changeOrder.update({
    where: { id },
    data: {
      jobId: updated.jobId,
      data: updated as unknown as object,
    },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'ChangeOrder',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
