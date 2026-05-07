// Postgres-backed store for bid results.

import { prisma } from '@yge/db';
import {
  BidResultSchema,
  newBidResultId,
  type BidResult,
  type BidResultCreate,
  type BidResultPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';
import { getRequestCompanyId } from './request-context';

const FALLBACK_COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
function companyId(): string {
  return getRequestCompanyId() ?? FALLBACK_COMPANY_ID;
}

function row2result(row: { data: unknown }): BidResult {
  return BidResultSchema.parse(row.data);
}

export async function createBidResult(
  input: BidResultCreate,
  ctx?: AuditContext,
): Promise<BidResult> {
  const now = new Date().toISOString();
  const id = newBidResultId();
  const r: BidResult = {
    id,
    createdAt: now,
    updatedAt: now,
    outcome: input.outcome ?? 'TBD',
    bidders: input.bidders ?? [],
    ...input,
  };
  BidResultSchema.parse(r);
  await prisma.bidResult.create({
    data: {
      id,
      companyId: companyId(),
      jobId: r.jobId ?? null,
      bidOpenedAt: r.bidOpenedAt,
      data: r as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'BidResult',
    entityId: id,
    after: r,
    ctx,
  });
  return r;
}

export async function listBidResults(filter?: { jobId?: string }): Promise<BidResult[]> {
  const rows = await prisma.bidResult.findMany({
    where: {
      companyId: companyId(),
      deletedAt: null,
      ...(filter?.jobId ? { jobId: filter.jobId } : {}),
    },
    orderBy: { bidOpenedAt: 'desc' },
  });
  return rows.map(row2result);
}

export async function getBidResult(id: string): Promise<BidResult | null> {
  if (!/^bid-result-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.bidResult.findFirst({
    where: { id, companyId: companyId(), deletedAt: null },
  });
  return row ? row2result(row) : null;
}

export async function updateBidResult(
  id: string,
  patch: BidResultPatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'reopen' = 'update',
): Promise<BidResult | null> {
  const existing = await getBidResult(id);
  if (!existing) return null;
  const updated: BidResult = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  BidResultSchema.parse(updated);
  await prisma.bidResult.update({
    where: { id },
    data: {
      jobId: updated.jobId ?? null,
      bidOpenedAt: updated.bidOpenedAt,
      data: updated as unknown as object,
    },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'BidResult',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
