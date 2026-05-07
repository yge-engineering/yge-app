// Postgres-backed store for legal holds.

import { prisma } from '@yge/db';
import {
  LegalHoldSchema,
  newLegalHoldId,
  type LegalHold,
  type LegalHoldCreate,
  type LegalHoldStatus,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';
import { getRequestCompanyId } from './request-context';

const FALLBACK_COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
function companyId(): string {
  return getRequestCompanyId() ?? FALLBACK_COMPANY_ID;
}

function row2hold(row: { data: unknown }): LegalHold {
  return LegalHoldSchema.parse(row.data);
}

export interface LegalHoldFilter {
  status?: LegalHoldStatus;
}

export async function listLegalHolds(filter: LegalHoldFilter = {}): Promise<LegalHold[]> {
  const rows = await prisma.legalHold.findMany({
    where: {
      companyId: companyId(),
      ...(filter.status === 'ACTIVE' ? { liftedAt: null } : {}),
      ...(filter.status === 'RELEASED' ? { liftedAt: { not: null } } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(row2hold);
}

export async function getLegalHold(id: string): Promise<LegalHold | null> {
  if (!/^hold-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.legalHold.findFirst({
    where: { id, companyId: companyId() },
  });
  return row ? row2hold(row) : null;
}

export async function createLegalHold(
  input: LegalHoldCreate,
  ctx?: AuditContext,
): Promise<LegalHold> {
  const now = new Date().toISOString();
  const id = newLegalHoldId();
  const h: LegalHold = LegalHoldSchema.parse({
    id,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'ACTIVE',
    ...input,
  });
  await prisma.legalHold.create({
    data: {
      id,
      companyId: companyId(),
      data: h as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'Document',
    entityId: id,
    after: h,
    ctx,
  });
  for (const e of h.entities) {
    await recordAudit({
      action: 'archive',
      entityType: e.entityType,
      entityId: e.entityId,
      after: { holdId: h.id, holdTitle: h.title, holdReason: h.reason },
      ctx: { ...ctx, reason: `Legal hold ${h.id}: ${h.reason}` },
    });
  }
  return h;
}

export async function releaseLegalHold(
  id: string,
  releasedByUserId: string | null,
  releasedReason: string,
  ctx?: AuditContext,
): Promise<LegalHold | null> {
  const existing = await getLegalHold(id);
  if (!existing) return null;
  if (existing.status !== 'ACTIVE') return existing;
  const now = new Date().toISOString();
  const updated: LegalHold = LegalHoldSchema.parse({
    ...existing,
    status: 'RELEASED',
    releasedAt: now,
    releasedByUserId: releasedByUserId ?? undefined,
    releasedReason,
    updatedAt: now,
  });
  await prisma.legalHold.update({
    where: { id },
    data: {
      liftedAt: new Date(now),
      data: updated as unknown as object,
    },
  });
  await recordAudit({
    action: 'restore',
    entityType: 'Document',
    entityId: id,
    before: existing,
    after: updated,
    ctx: { ...ctx, reason: releasedReason },
  });
  for (const e of existing.entities) {
    await recordAudit({
      action: 'restore',
      entityType: e.entityType,
      entityId: e.entityId,
      after: { holdId: id, releasedAt: now },
      ctx: { ...ctx, reason: `Legal hold ${id} released: ${releasedReason}` },
    });
  }
  return updated;
}
