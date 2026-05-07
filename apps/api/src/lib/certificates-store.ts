// Postgres-backed store for certificates.

import { prisma } from '@yge/db';
import {
  CertificateSchema,
  newCertificateId,
  type Certificate,
  type CertificateCreate,
  type CertificatePatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

function row2cert(row: { data: unknown }): Certificate {
  return CertificateSchema.parse(row.data);
}

export async function createCertificate(
  input: CertificateCreate,
  ctx?: AuditContext,
): Promise<Certificate> {
  const now = new Date().toISOString();
  const id = newCertificateId();
  const c: Certificate = {
    id,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'ACTIVE',
    ...input,
  };
  CertificateSchema.parse(c);
  await prisma.certificate.create({
    data: {
      id,
      companyId: DEFAULT_COMPANY_ID,
      expiresOn: c.expiresOn ?? null,
      data: c as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'Certificate',
    entityId: id,
    after: c,
    ctx,
  });
  return c;
}

export async function listCertificates(): Promise<Certificate[]> {
  const rows = await prisma.certificate.findMany({
    where: { companyId: DEFAULT_COMPANY_ID, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  const all = rows.map(row2cert);
  all.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'ACTIVE' ? -1 : 1;
    const ax = a.expiresOn ?? '9999-99-99';
    const bx = b.expiresOn ?? '9999-99-99';
    return ax.localeCompare(bx);
  });
  return all;
}

export async function getCertificate(id: string): Promise<Certificate | null> {
  if (!/^cert-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.certificate.findFirst({
    where: { id, companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  return row ? row2cert(row) : null;
}

export async function updateCertificate(
  id: string,
  patch: CertificatePatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'archive' = 'update',
): Promise<Certificate | null> {
  const existing = await getCertificate(id);
  if (!existing) return null;
  const updated: Certificate = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  CertificateSchema.parse(updated);
  await prisma.certificate.update({
    where: { id },
    data: {
      expiresOn: updated.expiresOn ?? null,
      data: updated as unknown as object,
    },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'Certificate',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
