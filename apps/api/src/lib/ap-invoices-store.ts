// Postgres-backed store for AP invoices.

import { prisma } from '@yge/db';
import {
  ApInvoiceSchema,
  newApInvoiceId,
  type ApInvoice,
  type ApInvoiceCreate,
  type ApInvoicePatch,
  type ApPaymentMethod,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';
import { getRequestCompanyId } from './request-context';

const FALLBACK_COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
function companyId(): string {
  return getRequestCompanyId() ?? FALLBACK_COMPANY_ID;
}

function row2inv(row: { data: unknown }): ApInvoice {
  return ApInvoiceSchema.parse(row.data);
}

export async function createApInvoice(
  input: ApInvoiceCreate,
  ctx?: AuditContext,
): Promise<ApInvoice> {
  const now = new Date().toISOString();
  const id = newApInvoiceId();
  const i: ApInvoice = {
    id,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'DRAFT',
    lineItems: input.lineItems ?? [],
    totalCents: input.totalCents ?? 0,
    paidCents: input.paidCents ?? 0,
    ...input,
  };
  ApInvoiceSchema.parse(i);
  await prisma.apInvoice.create({
    data: {
      id,
      companyId: companyId(),
      // ApInvoice schema uses vendorName (string) not a vendorId; the
      // Prisma row's vendorId column is null until a Vendor-master FK
      // is wired up.
      vendorId: null,
      status: i.status,
      data: i as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'ApInvoice',
    entityId: id,
    after: i,
    ctx,
  });
  return i;
}

export async function listApInvoices(filter?: {
  status?: string;
  jobId?: string;
}): Promise<ApInvoice[]> {
  const rows = await prisma.apInvoice.findMany({
    where: {
      companyId: companyId(),
      deletedAt: null,
      ...(filter?.status ? { status: filter.status } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  let all = rows.map(row2inv);
  if (filter?.jobId) all = all.filter((i) => i.jobId === filter.jobId);
  all.sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));
  return all;
}

export async function getApInvoice(id: string): Promise<ApInvoice | null> {
  if (!/^ap-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.apInvoice.findFirst({
    where: { id, companyId: companyId(), deletedAt: null },
  });
  return row ? row2inv(row) : null;
}

export async function updateApInvoice(
  id: string,
  patch: ApInvoicePatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'approve' | 'pay' | 'reject' = 'update',
): Promise<ApInvoice | null> {
  const existing = await getApInvoice(id);
  if (!existing) return null;
  const updated: ApInvoice = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  ApInvoiceSchema.parse(updated);
  await prisma.apInvoice.update({
    where: { id },
    data: {
      status: updated.status,
      data: updated as unknown as object,
    },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'ApInvoice',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}

export async function approveApInvoice(
  id: string,
  approvedByEmployeeId?: string,
  ctx?: AuditContext,
): Promise<ApInvoice | null> {
  return updateApInvoice(
    id,
    {
      status: 'APPROVED',
      approvedAt: new Date().toISOString(),
      approvedByEmployeeId,
    },
    ctx,
    'approve',
  );
}

export async function payApInvoice(
  id: string,
  paidAt: string,
  paymentMethod: ApPaymentMethod,
  paymentReference: string | undefined,
  amountCents: number,
  ctx?: AuditContext,
): Promise<ApInvoice | null> {
  const existing = await getApInvoice(id);
  if (!existing) return null;
  const newPaid = existing.paidCents + amountCents;
  const fullyPaid = newPaid >= existing.totalCents;
  return updateApInvoice(
    id,
    {
      paidCents: newPaid,
      paidAt,
      paymentMethod,
      paymentReference,
      status: fullyPaid ? 'PAID' : existing.status === 'DRAFT' ? 'APPROVED' : existing.status,
    },
    ctx,
    'pay',
  );
}

export async function rejectApInvoice(
  id: string,
  reason: string,
  ctx?: AuditContext,
): Promise<ApInvoice | null> {
  return updateApInvoice(
    id,
    {
      status: 'REJECTED',
      rejectedReason: reason,
    },
    { ...ctx, reason },
    'reject',
  );
}
