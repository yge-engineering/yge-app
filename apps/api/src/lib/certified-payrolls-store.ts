// Postgres-backed store for certified payrolls.

import { prisma } from '@yge/db';
import {
  CertifiedPayrollSchema,
  newCertifiedPayrollId,
  type CertifiedPayroll,
  type CertifiedPayrollCreate,
  type CertifiedPayrollPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';
import { getRequestCompanyId } from './request-context';

const FALLBACK_COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
function companyId(): string {
  return getRequestCompanyId() ?? FALLBACK_COMPANY_ID;
}

function row2cpr(row: { data: unknown }): CertifiedPayroll {
  return CertifiedPayrollSchema.parse(row.data);
}

export async function createCertifiedPayroll(
  input: CertifiedPayrollCreate,
  ctx?: AuditContext,
): Promise<CertifiedPayroll> {
  const now = new Date().toISOString();
  const id = newCertifiedPayrollId();
  const c: CertifiedPayroll = {
    id,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'DRAFT',
    rows: input.rows ?? [],
    payrollNumber: input.payrollNumber ?? 1,
    isFinalPayroll: input.isFinalPayroll ?? false,
    complianceStatementSigned: input.complianceStatementSigned ?? false,
    ...input,
  };
  CertifiedPayrollSchema.parse(c);
  await prisma.certifiedPayroll.create({
    data: {
      id,
      companyId: companyId(),
      jobId: c.jobId,
      weekEnding: c.weekEnding,
      data: c as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'CertifiedPayroll',
    entityId: id,
    after: c,
    ctx,
  });
  return c;
}

export async function listCertifiedPayrolls(filter?: {
  jobId?: string;
  status?: string;
}): Promise<CertifiedPayroll[]> {
  const rows = await prisma.certifiedPayroll.findMany({
    where: {
      companyId: companyId(),
      deletedAt: null,
      ...(filter?.jobId ? { jobId: filter.jobId } : {}),
    },
    orderBy: { weekEnding: 'desc' },
  });
  let all = rows.map(row2cpr);
  if (filter?.status) all = all.filter((c) => c.status === filter.status);
  return all;
}

export async function getCertifiedPayroll(id: string): Promise<CertifiedPayroll | null> {
  if (!/^cpr-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.certifiedPayroll.findFirst({
    where: { id, companyId: companyId(), deletedAt: null },
  });
  return row ? row2cpr(row) : null;
}

export async function updateCertifiedPayroll(
  id: string,
  patch: CertifiedPayrollPatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'sign' | 'submit' = 'update',
): Promise<CertifiedPayroll | null> {
  const existing = await getCertifiedPayroll(id);
  if (!existing) return null;
  const updated: CertifiedPayroll = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  CertifiedPayrollSchema.parse(updated);
  await prisma.certifiedPayroll.update({
    where: { id },
    data: {
      jobId: updated.jobId,
      weekEnding: updated.weekEnding,
      data: updated as unknown as object,
    },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'CertifiedPayroll',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
