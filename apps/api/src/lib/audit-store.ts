// File-based audit-event store + recordAudit helper.
//
// Plain English: every meaningful mutation across the API drops a
// row here. CLAUDE.md mandates 'every mutation is audit-logged';
// this file is the persistence + the helper stores call.
//
// Phase 1 implementation matches the rest of the API's storage
// pattern — JSON files on disk under data/audit-events/ — so
// dev-mode runs without Postgres and the audit trail still
// survives. When Prisma persistence lands, the recordAudit helper
// gets a parallel write path; the on-disk rows can be replayed in.
//
// Storage layout:
//   data/audit-events/index.json    array of all events, newest first
//   data/audit-events/<id>.json     one row per event
//
// Each event record satisfies AuditEventSchema from @yge/shared.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  AuditEventSchema,
  applyAuditFilter,
  newAuditEventId,
  type AuditAction,
  type AuditEntityType,
  type AuditEvent,
  type AuditFilter,
} from '@yge/shared';

function dataDir(): string {
  return (
    process.env.AUDIT_EVENTS_DATA_DIR ??
    path.resolve(process.cwd(), 'data', 'audit-events')
  );
}
function indexPath(): string {
  return path.join(dataDir(), 'index.json');
}
function rowPath(id: string): string {
  return path.join(dataDir(), `${id}.json`);
}

async function ensureDir() {
  await fs.mkdir(dataDir(), { recursive: true });
}

async function readIndex(): Promise<AuditEvent[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = AuditEventSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((e): e is AuditEvent => e !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: AuditEvent[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

/**
 * Default tenant scope while the multi-tenant column is still
 * single-valued in dev. Override per call when the API edge has a
 * real session.
 */
const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'co-yge';

/**
 * Context attached to a recorded event from the API edge — IP, UA,
 * actor — populated by middleware that has the request handle. The
 * `actorUserId` is null when the action is a system process
 * (scheduled DIR scrape, automated rate verification).
 */
export interface AuditContext {
  companyId?: string;
  actorUserId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  reason?: string | null;
}

/**
 * Record one audit event. The store is fail-soft — a write error
 * here MUST NOT bubble up and break the underlying mutation. We
 * log to stderr instead and let the caller continue. The trade-off:
 * a single audit row can go missing if the disk is full; the
 * alternative (every mutation rolling back when audit-write fails)
 * is the worse failure mode.
 */
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
    // The schema rejected the event itself — log and bail rather
    // than emit a malformed row.
    // eslint-disable-next-line no-console
    console.error('[audit] dropping malformed event:', err);
    return null;
  }
  try {
    await ensureDir();
    await fs.writeFile(rowPath(id), JSON.stringify(e, null, 2), 'utf8');
    const index = await readIndex();
    index.unshift(e);
    await writeIndex(index);
    return e;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[audit] write failed; mutation continues:', err);
    return null;
  }
}

export async function listAuditEvents(filter: AuditFilter = {}): Promise<AuditEvent[]> {
  const all = await readIndex();
  return applyAuditFilter(all, filter);
}

export async function getAuditEvent(id: string): Promise<AuditEvent | null> {
  if (!/^audit-[a-z0-9]+$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return AuditEventSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}
