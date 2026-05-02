// Audit log — who did what, when, from where, before-state, after-state.
//
// Plain English: every meaningful change in the app drops a row here.
// Comes up most when someone has to answer "when did this estimate's
// O&P change from 12% to 15%?" or "who reassigned this employee off
// Sulphur Springs?" The trail is also the spine of any IRS, DIR,
// Cal/OSHA, or PAGA audit response — auditors want to see who edited
// what, and the answer should not be "let me ask the bookkeeper."
//
// Mirrors the Prisma `AuditEvent` model in packages/db/prisma/schema.prisma.
// Keep these schemas in sync.
//
// Pure data + helpers. The file-store / Prisma persistence layer lives in
// the API package; this module is the canonical shape and the rules for
// composing event records.

import { z } from 'zod';

/**
 * Action verbs we use across the app. Free-form string in the Prisma
 * model, but we narrow it here so the autocomplete works and so a typo
 * (`'update'` vs `'updated'`) can't fragment the event stream.
 */
export const AuditActionSchema = z.enum([
  'create',
  'update',
  'delete',
  'archive',
  'restore',
  'submit',
  'approve',
  'reject',
  'reopen',
  'close',
  'answer',
  'acknowledge',
  'cancel',
  'sign',
  'void',
  'pay',
  'post',
  'unpost',
  'assign',
  'unassign',
  'login',
  'logout',
  'export',
  'import',
  'view', // restricted-content access only — don't log every page view
  'purge', // records-retention destruction; only after operator confirm
]);
export type AuditAction = z.infer<typeof AuditActionSchema>;

/**
 * Entity types we audit. Add new ones here as new modules become
 * audit-worthy. The string is the canonical Prisma model name (or a
 * stable file-store key when there is no Prisma model yet).
 */
export const AuditEntityTypeSchema = z.enum([
  'Account',
  'ApInvoice',
  'ApPayment',
  'ArInvoice',
  'ArPayment',
  'BankRec',
  'BidItem',
  'BidResult',
  'Certificate',
  'CertifiedPayroll',
  'ChangeOrder',
  'Company',
  'CostCode',
  'CostLine',
  'Customer',
  'DailyReport',
  'DirRateSchedule',
  'Dispatch',
  'Document',
  'Employee',
  'EmployeeCertification',
  'Equipment',
  'EquipmentRate',
  'EquipmentRental',
  'Estimate',
  'Expense',
  'Incident',
  'JournalEntry',
  'Job',
  'LaborRate',
  'LienWaiver',
  'Material',
  'Mileage',
  'Officer',
  'Pco',
  'Photo',
  'PunchItem',
  'Rfi',
  'Signature',
  'Subcontractor',
  'Submittal',
  'SwpppInspection',
  'TimeCard',
  'ToolboxTalk',
  'Tool',
  'User',
  'Vendor',
  'WeatherLog',
]);
export type AuditEntityType = z.infer<typeof AuditEntityTypeSchema>;

/**
 * One audit row. Mirrors `model AuditEvent` in the Prisma schema
 * 1:1 — `before` / `after` carry the full pre/post snapshot of the
 * entity for `update`, the new record for `create`, the deleted
 * record for `delete`, and `null` for actions that don't have a
 * meaningful entity-state diff (e.g. `login`, `view`).
 */
export const AuditEventSchema = z.object({
  /** Stable id of the form `audit-<8hex>`. CUID in Prisma; keep both
   *  patterns acceptable so file-store and DB rows can be merged. */
  id: z.string().min(1).max(80),
  createdAt: z.string(),

  /** Tenant scope. Always required — multi-tenant from day one. */
  companyId: z.string().min(1).max(120),

  /** Who. Null only when the action came from a system process
   *  (scheduled DIR scrape, automated rate verification). */
  actorUserId: z.string().max(120).nullish(),

  action: AuditActionSchema,
  entityType: AuditEntityTypeSchema,
  entityId: z.string().min(1).max(120),

  /** Pre/post entity snapshot. Plain JSON so historical rows survive
   *  schema migrations. Both null on actions with no entity body
   *  (login/view), `before` null on `create`, `after` null on
   *  `delete`. */
  before: z.unknown().nullish(),
  after: z.unknown().nullish(),

  /** Optional context for security review. Capture at the API edge. */
  ipAddress: z.string().max(64).nullish(),
  userAgent: z.string().max(500).nullish(),

  /** Optional free-form reason — required by some flows (sign-off,
   *  void, override of a CA labor-law block). Plain English; this is
   *  what the auditor reads. */
  reason: z.string().max(2_000).nullish(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

/** Input schema for recording a new event. The id and createdAt are
 *  filled by the store. */
export const AuditEventCreateSchema = AuditEventSchema.omit({
  id: true,
  createdAt: true,
});
export type AuditEventCreate = z.infer<typeof AuditEventCreateSchema>;

// ---- Helpers ------------------------------------------------------------

export function newAuditEventId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `audit-${hex.padStart(8, '0')}`;
}

/**
 * Compose the canonical action key used in dashboards and search:
 * `"<entityType>.<action>"`, lowercased entity. This is the format the
 * Prisma model's `action` column actually stores.
 */
export function auditActionKey(entityType: AuditEntityType, action: AuditAction): string {
  return `${entityType.toLowerCase()}.${action}`;
}

/**
 * Shallow-compute the field diff between `before` and `after`. Returns
 * the keys whose values differ. Useful for the audit-log row preview
 * ("Changed: oppPercent, status") without rendering full JSON.
 *
 * - Top-level keys only. Deep diffs are deliberately out of scope —
 *   the full snapshots already live in the row, and a deep diff is a
 *   UI concern best handled at render time.
 * - Returns `[]` when either side is missing or not a plain object.
 */
export function changedFields(
  before: unknown,
  after: unknown,
): string[] {
  if (!isPlainObject(before) || !isPlainObject(after)) return [];
  const keys = new Set<string>([...Object.keys(before), ...Object.keys(after)]);
  const out: string[] = [];
  for (const k of keys) {
    if (!shallowEqual(before[k], after[k])) out.push(k);
  }
  out.sort();
  return out;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) if (!shallowEqual(a[i], b[i])) return false;
    return true;
  }
  // Plain objects — compare by JSON. Cheap and correct for our snapshot
  // shapes (no functions, no dates-as-objects, no cycles).
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Filter rules for querying the audit log.
 */
export interface AuditFilter {
  companyId?: string;
  actorUserId?: string;
  entityType?: AuditEntityType;
  entityId?: string;
  action?: AuditAction;
  /** Inclusive yyyy-mm-dd window applied against createdAt's date part. */
  fromDate?: string;
  toDate?: string;
}

export function applyAuditFilter(events: AuditEvent[], f: AuditFilter): AuditEvent[] {
  return events.filter((e) => {
    if (f.companyId && e.companyId !== f.companyId) return false;
    if (f.actorUserId !== undefined && e.actorUserId !== f.actorUserId) return false;
    if (f.entityType && e.entityType !== f.entityType) return false;
    if (f.entityId && e.entityId !== f.entityId) return false;
    if (f.action && e.action !== f.action) return false;
    if (f.fromDate && e.createdAt.slice(0, 10) < f.fromDate) return false;
    if (f.toDate && e.createdAt.slice(0, 10) > f.toDate) return false;
    return true;
  });
}

/**
 * Per-entity history reduced to one stable timeline. Sorted oldest →
 * newest by `createdAt`. The full event list (before/after snapshots
 * intact) is what renders on the audit panel of any record's binder.
 */
export function entityHistory(
  events: AuditEvent[],
  entityType: AuditEntityType,
  entityId: string,
): AuditEvent[] {
  return events
    .filter((e) => e.entityType === entityType && e.entityId === entityId)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
}

export interface AuditRollup {
  total: number;
  /** Most-recent event timestamp (ISO). */
  lastAt: string | null;
  /** Counts per (entityType, action) pair. Sorted by count desc. */
  byActionKey: Array<{ key: string; count: number }>;
  /** Distinct actor count over the window. Null actors (system) count
   *  as one group keyed `'__system__'`. */
  distinctActors: number;
}

export function computeAuditRollup(events: AuditEvent[]): AuditRollup {
  const byKey = new Map<string, number>();
  const actors = new Set<string>();
  let lastAt: string | null = null;
  for (const e of events) {
    const k = auditActionKey(e.entityType, e.action);
    byKey.set(k, (byKey.get(k) ?? 0) + 1);
    actors.add(e.actorUserId ?? '__system__');
    if (!lastAt || e.createdAt > lastAt) lastAt = e.createdAt;
  }
  return {
    total: events.length,
    lastAt,
    byActionKey: Array.from(byKey.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)),
    distinctActors: actors.size,
  };
}
