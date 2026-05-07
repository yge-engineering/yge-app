// Postgres-backed store for AR payments.

import { prisma } from '@yge/db';
import {
  ArPaymentSchema,
  newArPaymentId,
  sumPaymentsForInvoice,
  type ArPayment,
  type ArPaymentCreate,
  type ArPaymentPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

function row2pay(row: { data: unknown }): ArPayment {
  return ArPaymentSchema.parse(row.data);
}

async function readAll(): Promise<ArPayment[]> {
  const rows = await prisma.arPayment.findMany({
    where: { companyId: DEFAULT_COMPANY_ID, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(row2pay);
}

export async function createArPayment(
  input: ArPaymentCreate,
  ctx?: AuditContext,
): Promise<ArPayment> {
  const now = new Date().toISOString();
  const id = newArPaymentId();
  const p: ArPayment = {
    id,
    createdAt: now,
    updatedAt: now,
    kind: input.kind ?? 'PROGRESS',
    method: input.method ?? 'CHECK',
    ...input,
  };
  ArPaymentSchema.parse(p);
  await prisma.arPayment.create({
    data: {
      id,
      companyId: DEFAULT_COMPANY_ID,
      data: p as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'ArPayment',
    entityId: id,
    after: p,
    ctx,
  });
  return p;
}

export async function listArPayments(filter?: {
  arInvoiceId?: string;
  jobId?: string;
}): Promise<ArPayment[]> {
  let all = await readAll();
  if (filter?.arInvoiceId) all = all.filter((p) => p.arInvoiceId === filter.arInvoiceId);
  if (filter?.jobId) all = all.filter((p) => p.jobId === filter.jobId);
  return all;
}

export async function getArPayment(id: string): Promise<ArPayment | null> {
  if (!/^arp-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.arPayment.findFirst({
    where: { id, companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  return row ? row2pay(row) : null;
}

export async function updateArPayment(
  id: string,
  patch: ArPaymentPatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'void' = 'update',
): Promise<ArPayment | null> {
  const existing = await getArPayment(id);
  if (!existing) return null;
  const updated: ArPayment = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  ArPaymentSchema.parse(updated);
  await prisma.arPayment.update({
    where: { id },
    data: { data: updated as unknown as object },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'ArPayment',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}

export async function totalPaidForInvoice(arInvoiceId: string): Promise<number> {
  const all = await readAll();
  return sumPaymentsForInvoice(arInvoiceId, all);
}
