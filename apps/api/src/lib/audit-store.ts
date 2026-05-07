// Postgres-backed audit-event store + recordAudit helper.
//
// Plain English: every meaningful mutation across the API drops a
// row here. CLAUDE.md mandates 'every mutation is audit-logged'.
//
// recordAudit() is fail-soft on purpose — a Postgres write error
// logs to stderr and returns null rather than letting the audit
// failure propagate and break the caller's mutation.

import { prisma, Prisma } from '@yge/db';
import {
  AuditEventSchema,
  applyAuditFilter,
  newAuditEventId,
  type AuditAction,
  type AuditEntityType,
  type AuditEvent,
  type AuditFilter,
} from '@yge/shared';

const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

export interface AuditContext {
  companyId?: string;
  actorUserId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  reason?: string | null;
}

function row2event(row: {
  id: string;
  companyId: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  reason: string | null;
  createdAt: Date;
}): AuditEvent | null {
  const candidate = {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    companyId: row.companyId,
    actorUserId: row.actorUserId,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    before: row.before ?? null,
    after: row.after ?? null,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    reason: row.reason,
  };
  const r = AuditEventSchema.safeParse(candidate);
  return r.success ? r.data : null;
}

export async function recordAudit(args: {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ctx?: AuditContext;
}): Promise<AuditEvent | null> {
  const id = newAuditEventId();
  const e: AuditEvent = {
    id,
    createdAt: new Date().toISOString(),
    companyId: args.ctx?.companyId ?? DEFAULT_COMPANY_ID,
    actorUserId: args.ctx?.actorUserId ?? null,
    action: args.action,
    entityType: args.entityType,
    entityId: args.entityId,
    before: args.before ?? null,
    after: args.after ?? null,
    ipAddress: args.ctx?.ipAddress ?? null,
    userAgent: args.ctx?.userAgent ?? null,
    reason: args.ctx?.reason ?? null,
  };
  try {
    AuditEventSchema.parse(e);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[audit] dropping malformed event:', err);
    return null;
  }
  try {
    await prisma.auditEvent.create({
      data: {
        id: e.id,
        companyId: e.companyId,
        actorUserId: e.actorUserId ?? null,
        action: e.action,
        entityType: e.entityType,
        entityId: e.entityId,
        before: (e.before ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        after: (e.after ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        ipAddress: e.ipAddress ?? null,
        userAgent: e.userAgent ?? null,
        reason: e.reason ?? null,
      },
    });
    return e;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[audit] write failed; mutation continues:', err);
    return null;
  }
}

export async function listAuditEvents(filter: AuditFilter = {}): Promise<AuditEvent[]> {
  const rows = await prisma.auditEvent.findMany({
    where: { companyId: DEFAULT_COMPANY_ID },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  const all = rows
    .map(row2event)
    .filter((e): e is AuditEvent => e !== null);
  return applyAuditFilter(all, filter);
}

export async function getAuditEvent(id: string): Promise<AuditEvent | null> {
  if (!/^audit-[a-z0-9]+$/.test(id)) return null;
  const row = await prisma.auditEvent.findFirst({
    where: { id, companyId: DEFAULT_COMPANY_ID },
  });
  if (!row) return null;
  return row2event(row);
}
