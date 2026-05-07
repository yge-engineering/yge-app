// Postgres-backed store for bank reconciliations.

import { prisma } from '@yge/db';
import {
  BankRecSchema,
  newBankRecId,
  type BankRec,
  type BankRecCreate,
  type BankRecPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';
import { getRequestCompanyId } from './request-context';

const FALLBACK_COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
function companyId(): string {
  return getRequestCompanyId() ?? FALLBACK_COMPANY_ID;
}

function row2rec(row: { data: unknown }): BankRec {
  return BankRecSchema.parse(row.data);
}

export async function createBankRec(
  input: BankRecCreate,
  ctx?: AuditContext,
): Promise<BankRec> {
  const now = new Date().toISOString();
  const id = newBankRecId();
  const r: BankRec = {
    id,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'DRAFT',
    outstandingChecksCents: input.outstandingChecksCents ?? 0,
    outstandingDepositsCents: input.outstandingDepositsCents ?? 0,
    adjustments: input.adjustments ?? [],
    ...input,
  };
  BankRecSchema.parse(r);
  await prisma.bankRec.create({
    data: {
      id,
      companyId: companyId(),
      accountId: r.bankAccountLabel,
      periodEnd: r.statementDate,
      data: r as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'BankRec',
    entityId: id,
    after: r,
    ctx,
  });
  return r;
}

export async function listBankRecs(filter?: {
  bankAccountLabel?: string;
  status?: string;
}): Promise<BankRec[]> {
  const rows = await prisma.bankRec.findMany({
    where: {
      companyId: companyId(),
      deletedAt: null,
      ...(filter?.bankAccountLabel ? { accountId: filter.bankAccountLabel } : {}),
    },
    orderBy: { periodEnd: 'desc' },
  });
  let all = rows.map(row2rec);
  if (filter?.status) all = all.filter((r) => r.status === filter.status);
  return all;
}

export async function getBankRec(id: string): Promise<BankRec | null> {
  if (!/^bnk-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.bankRec.findFirst({
    where: { id, companyId: companyId(), deletedAt: null },
  });
  return row ? row2rec(row) : null;
}

export async function updateBankRec(
  id: string,
  patch: BankRecPatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'post' | 'void' = 'update',
): Promise<BankRec | null> {
  const existing = await getBankRec(id);
  if (!existing) return null;
  const updated: BankRec = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  BankRecSchema.parse(updated);
  await prisma.bankRec.update({
    where: { id },
    data: {
      accountId: updated.bankAccountLabel,
      periodEnd: updated.statementDate,
      data: updated as unknown as object,
    },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'BankRec',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
