// Postgres-backed store for AP payments.

import { prisma } from '@yge/db';
import {
  ApPaymentSchema,
  newApPaymentId,
  sumApPaymentsForInvoice,
  type ApPayment,
  type ApPaymentCreate,
  type ApPaymentPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

function row2pay(row: { data: unknown }): ApPayment {
  return ApPaymentSchema.parse(row.data);
}

async function readAll(): Promise<ApPayment[]> {
  const rows = await prisma.apPayment.findMany({
    where: { companyId: DEFAULT_COMPANY_ID, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(row2pay);
}

export async function createApPayment(
  input: ApPaymentCreate,
  ctx?: AuditContext,
): Promise<ApPayment> {
  const now = new Date().toISOString();
  const id = newApPaymentId();
  const p: ApPayment = {
    id,
    createdAt: now,
    updatedAt: now,
    method: input.method ?? 'CHECK',
    cleared: input.cleared ?? false,
    voided: input.voided ?? false,
    ...input,
  };
  ApPaymentSchema.parse(p);
  await prisma.apPayment.create({
    data: {
      id,
      companyId: DEFAULT_COMPANY_ID,
      data: p as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'ApPayment',
    entityId: id,
    after: p,
    ctx,
  });
  return p;
}

export async function listApPayments(filter?: {
  apInvoiceId?: string;
  method?: string;
}): Promise<ApPayment[]> {
  let all = await readAll();
  if (filter?.apInvoiceId) all = all.filter((p) => p.apInvoiceId === filter.apInvoiceId);
  if (filter?.method) all = all.filter((p) => p.method === filter.method);
  return all;
}

export async function getApPayment(id: string): Promise<ApPayment | null> {
  if (!/^app-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.apPayment.findFirst({
    where: { id, companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  return row ? row2pay(row) : null;
}

export async function updateApPayment(
  id: string,
  patch: ApPaymentPatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'void' | 'pay' = 'update',
): Promise<ApPayment | null> {
  const existing = await getApPayment(id);
  if (!existing) return null;
  const updated: ApPayment = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  ApPaymentSchema.parse(updated);
  await prisma.apPayment.update({
    where: { id },
    data: { data: updated as unknown as object },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'ApPayment',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}

export async function totalPaidForApInvoice(apInvoiceId: string): Promise<number> {
  const all = await readAll();
  return sumApPaymentsForInvoice(apInvoiceId, all);
}
