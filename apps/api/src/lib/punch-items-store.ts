// Postgres-backed store for punch items.

import { prisma } from '@yge/db';
import {
  PunchItemSchema,
  newPunchItemId,
  type PunchItem,
  type PunchItemCreate,
  type PunchItemPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';
import { getRequestCompanyId } from './request-context';

const FALLBACK_COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
function companyId(): string {
  return getRequestCompanyId() ?? FALLBACK_COMPANY_ID;
}

function row2pi(row: { data: unknown }): PunchItem {
  return PunchItemSchema.parse(row.data);
}

export async function createPunchItem(
  input: PunchItemCreate,
  ctx?: AuditContext,
): Promise<PunchItem> {
  const now = new Date().toISOString();
  const id = newPunchItemId();
  const p: PunchItem = {
    id,
    createdAt: now,
    updatedAt: now,
    severity: input.severity ?? 'MINOR',
    status: input.status ?? 'OPEN',
    ...input,
  };
  PunchItemSchema.parse(p);
  await prisma.punchItem.create({
    data: {
      id,
      companyId: companyId(),
      jobId: p.jobId,
      status: p.status,
      data: p as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'PunchItem',
    entityId: id,
    after: p,
    ctx,
  });
  return p;
}

export async function listPunchItems(filter?: {
  jobId?: string;
  status?: string;
}): Promise<PunchItem[]> {
  const rows = await prisma.punchItem.findMany({
    where: {
      companyId: companyId(),
      deletedAt: null,
      ...(filter?.jobId ? { jobId: filter.jobId } : {}),
      ...(filter?.status ? { status: filter.status } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(row2pi);
}

export async function getPunchItem(id: string): Promise<PunchItem | null> {
  if (!/^pi-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.punchItem.findFirst({
    where: { id, companyId: companyId(), deletedAt: null },
  });
  return row ? row2pi(row) : null;
}

export async function updatePunchItem(
  id: string,
  patch: PunchItemPatch,
  ctx?: AuditContext,
  auditAction: 'update' = 'update',
): Promise<PunchItem | null> {
  const existing = await getPunchItem(id);
  if (!existing) return null;
  const updated: PunchItem = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  PunchItemSchema.parse(updated);
  await prisma.punchItem.update({
    where: { id },
    data: {
      jobId: updated.jobId,
      status: updated.status,
      data: updated as unknown as object,
    },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'PunchItem',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
