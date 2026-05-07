// Postgres-backed store for AR invoices.

import { prisma } from '@yge/db';
import {
  ArInvoiceSchema,
  newArInvoiceId,
  type ArInvoice,
  type ArInvoiceCreate,
  type ArInvoicePatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

function row2inv(row: { data: unknown }): ArInvoice {
  return ArInvoiceSchema.parse(row.data);
}

export async function createArInvoice(
  input: ArInvoiceCreate,
  ctx?: AuditContext,
): Promise<ArInvoice> {
  const now = new Date().toISOString();
  const id = newArInvoiceId();
  const i: ArInvoice = {
    id,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'DRAFT',
    source: input.source ?? 'MANUAL',
    lineItems: input.lineItems ?? [],
    subtotalCents: input.subtotalCents ?? 0,
    totalCents: input.totalCents ?? 0,
    paidCents: input.paidCents ?? 0,
    ...input,
  };
  ArInvoiceSchema.parse(i);
  await prisma.arInvoice.create({
    data: {
      id,
      companyId: DEFAULT_COMPANY_ID,
      jobId: i.jobId ?? null,
      status: i.status,
      data: i as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'ArInvoice',
    entityId: id,
    after: i,
    ctx,
  });
  return i;
}

export async function listArInvoices(filter?: {
  status?: string;
  jobId?: string;
}): Promise<ArInvoice[]> {
  const rows = await prisma.arInvoice.findMany({
    where: {
      companyId: DEFAULT_COMPANY_ID,
      deletedAt: null,
      ...(filter?.status ? { status: filter.status } : {}),
      ...(filter?.jobId ? { jobId: filter.jobId } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  const all = rows.map(row2inv);
  all.sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));
  return all;
}

export async function getArInvoice(id: string): Promise<ArInvoice | null> {
  if (!/^ar-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.arInvoice.findFirst({
    where: { id, companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  return row ? row2inv(row) : null;
}

export async function updateArInvoice(
  id: string,
  patch: ArInvoicePatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'approve' | 'void' | 'pay' = 'update',
): Promise<ArInvoice | null> {
  const existing = await getArInvoice(id);
  if (!existing) return null;
  const updated: ArInvoice = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  ArInvoiceSchema.parse(updated);
  await prisma.arInvoice.update({
    where: { id },
    data: {
      jobId: updated.jobId ?? null,
      status: updated.status,
      data: updated as unknown as object,
    },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'ArInvoice',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
