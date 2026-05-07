// Postgres-backed store for time cards.

import { prisma } from '@yge/db';
import {
  TimeCardSchema,
  newTimeCardId,
  type TimeCard,
  type TimeCardCreate,
  type TimeCardPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';
import { getRequestCompanyId } from './request-context';

const FALLBACK_COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
function companyId(): string {
  return getRequestCompanyId() ?? FALLBACK_COMPANY_ID;
}

function row2tc(row: { data: unknown }): TimeCard {
  return TimeCardSchema.parse(row.data);
}

export async function createTimeCard(
  input: TimeCardCreate,
  ctx?: AuditContext,
): Promise<TimeCard> {
  const now = new Date().toISOString();
  const id = newTimeCardId();
  const c: TimeCard = {
    id,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'DRAFT',
    entries: input.entries ?? [],
    ...input,
  };
  TimeCardSchema.parse(c);
  await prisma.timeCard.create({
    data: {
      id,
      companyId: companyId(),
      employeeId: c.employeeId,
      weekStart: c.weekStarting,
      data: c as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'TimeCard',
    entityId: id,
    after: c,
    ctx,
  });
  return c;
}

export async function listTimeCards(filter?: {
  employeeId?: string;
  weekStarting?: string;
  status?: string;
}): Promise<TimeCard[]> {
  const rows = await prisma.timeCard.findMany({
    where: {
      companyId: companyId(),
      deletedAt: null,
      ...(filter?.employeeId ? { employeeId: filter.employeeId } : {}),
      ...(filter?.weekStarting ? { weekStart: filter.weekStarting } : {}),
    },
    orderBy: { weekStart: 'desc' },
  });
  let all = rows.map(row2tc);
  if (filter?.status) all = all.filter((c) => c.status === filter.status);
  return all;
}

export async function getTimeCard(id: string): Promise<TimeCard | null> {
  if (!/^tc-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.timeCard.findFirst({
    where: { id, companyId: companyId(), deletedAt: null },
  });
  return row ? row2tc(row) : null;
}

export async function updateTimeCard(
  id: string,
  patch: TimeCardPatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'submit' | 'approve' | 'reject' | 'post' = 'update',
): Promise<TimeCard | null> {
  const existing = await getTimeCard(id);
  if (!existing) return null;
  const updated: TimeCard = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  TimeCardSchema.parse(updated);
  await prisma.timeCard.update({
    where: { id },
    data: {
      employeeId: updated.employeeId,
      weekStart: updated.weekStarting,
      data: updated as unknown as object,
    },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'TimeCard',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
