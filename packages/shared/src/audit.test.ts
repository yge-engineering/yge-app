import { describe, expect, it } from 'vitest';
import {
  applyAuditFilter,
  AuditEventSchema,
  auditActionKey,
  changedFields,
  computeAuditRollup,
  entityHistory,
  newAuditEventId,
  type AuditEvent,
} from './audit';

function ev(over: Partial<AuditEvent>): AuditEvent {
  return AuditEventSchema.parse({
    id: 'audit-aaaaaaaa',
    createdAt: '2026-04-01T08:00:00Z',
    companyId: 'co-yge',
    actorUserId: 'user-ryan',
    action: 'update',
    entityType: 'Estimate',
    entityId: 'est-aaaaaaaa',
    before: { oppPercent: 12 },
    after: { oppPercent: 15 },
    ipAddress: null,
    userAgent: null,
    reason: null,
    ...over,
  });
}

describe('newAuditEventId', () => {
  it('produces an audit-<8hex> id', () => {
    expect(newAuditEventId()).toMatch(/^audit-[0-9a-f]{8}$/);
  });
});

describe('auditActionKey', () => {
  it('lowercases entity + dot + action', () => {
    expect(auditActionKey('Estimate', 'update')).toBe('estimate.update');
    expect(auditActionKey('ApInvoice', 'pay')).toBe('apinvoice.pay');
  });
});

describe('changedFields', () => {
  it('lists keys whose values differ at the top level', () => {
    expect(
      changedFields(
        { oppPercent: 12, status: 'DRAFT' },
        { oppPercent: 15, status: 'DRAFT' },
      ),
    ).toEqual(['oppPercent']);
  });

  it('catches added and removed keys', () => {
    expect(
      changedFields(
        { a: 1 },
        { a: 1, b: 2 },
      ),
    ).toEqual(['b']);
    expect(
      changedFields(
        { a: 1, b: 2 },
        { a: 1 },
      ),
    ).toEqual(['b']);
  });

  it('returns [] when either side is not a plain object', () => {
    expect(changedFields(null, { a: 1 })).toEqual([]);
    expect(changedFields({ a: 1 }, [1, 2, 3])).toEqual([]);
    expect(changedFields(undefined, undefined)).toEqual([]);
  });

  it('treats deeply equal nested values as unchanged', () => {
    expect(
      changedFields(
        { line: { qty: 10, unit: 'CY' } },
        { line: { qty: 10, unit: 'CY' } },
      ),
    ).toEqual([]);
  });
});

describe('applyAuditFilter', () => {
  const events: AuditEvent[] = [
    ev({ id: 'audit-11111111', actorUserId: 'user-ryan', action: 'create', entityType: 'Estimate', entityId: 'est-1', createdAt: '2026-03-15T08:00:00Z' }),
    ev({ id: 'audit-22222222', actorUserId: 'user-brook', action: 'approve', entityType: 'Estimate', entityId: 'est-1', createdAt: '2026-03-20T08:00:00Z' }),
    ev({ id: 'audit-33333333', actorUserId: 'user-ryan', action: 'update', entityType: 'ApInvoice', entityId: 'inv-1', createdAt: '2026-04-01T08:00:00Z' }),
    ev({ id: 'audit-44444444', actorUserId: null, action: 'import', entityType: 'DirRateSchedule', entityId: 'dir-2026-04', createdAt: '2026-04-02T08:00:00Z' }),
  ];

  it('filters by entityType + entityId', () => {
    const r = applyAuditFilter(events, { entityType: 'Estimate', entityId: 'est-1' });
    expect(r.map((e) => e.id)).toEqual(['audit-11111111', 'audit-22222222']);
  });

  it('filters by actor + date window', () => {
    const r = applyAuditFilter(events, {
      actorUserId: 'user-ryan',
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
    });
    expect(r.map((e) => e.id)).toEqual(['audit-33333333']);
  });

  it('filters by action only', () => {
    const r = applyAuditFilter(events, { action: 'import' });
    expect(r.map((e) => e.id)).toEqual(['audit-44444444']);
  });
});

describe('entityHistory', () => {
  it('returns events for one entity sorted oldest to newest', () => {
    const events: AuditEvent[] = [
      ev({ id: 'audit-22222222', entityId: 'est-1', createdAt: '2026-03-20T08:00:00Z', action: 'approve' }),
      ev({ id: 'audit-11111111', entityId: 'est-1', createdAt: '2026-03-15T08:00:00Z', action: 'create' }),
      ev({ id: 'audit-99999999', entityId: 'est-2', createdAt: '2026-03-25T08:00:00Z' }),
    ];
    const r = entityHistory(events, 'Estimate', 'est-1');
    expect(r.map((e) => e.id)).toEqual(['audit-11111111', 'audit-22222222']);
  });
});

describe('computeAuditRollup', () => {
  it('rolls up totals, last timestamp, action mix, distinct actors', () => {
    const events: AuditEvent[] = [
      ev({ id: 'audit-11111111', actorUserId: 'user-ryan', action: 'create', entityType: 'Estimate', createdAt: '2026-03-15T08:00:00Z' }),
      ev({ id: 'audit-22222222', actorUserId: 'user-ryan', action: 'update', entityType: 'Estimate', createdAt: '2026-03-16T08:00:00Z' }),
      ev({ id: 'audit-33333333', actorUserId: 'user-brook', action: 'update', entityType: 'Estimate', createdAt: '2026-03-17T08:00:00Z' }),
      ev({ id: 'audit-44444444', actorUserId: null, action: 'import', entityType: 'DirRateSchedule', createdAt: '2026-04-02T08:00:00Z' }),
    ];
    const r = computeAuditRollup(events);
    expect(r.total).toBe(4);
    expect(r.lastAt).toBe('2026-04-02T08:00:00Z');
    expect(r.distinctActors).toBe(3); // ryan + brook + __system__
    expect(r.byActionKey[0]).toEqual({ key: 'estimate.update', count: 2 });
  });

  it('handles empty input', () => {
    const r = computeAuditRollup([]);
    expect(r).toEqual({ total: 0, lastAt: null, byActionKey: [], distinctActors: 0 });
  });
});

describe('AuditEventSchema', () => {
  it('rejects an invalid action', () => {
    expect(() =>
      AuditEventSchema.parse({
        id: 'audit-aaaaaaaa',
        createdAt: '2026-04-01T08:00:00Z',
        companyId: 'co-yge',
        actorUserId: 'user-ryan',
        action: 'frobnicate',
        entityType: 'Estimate',
        entityId: 'est-1',
      }),
    ).toThrow();
  });

  it('accepts a system event with no actor', () => {
    const e = AuditEventSchema.parse({
      id: 'audit-bbbbbbbb',
      createdAt: '2026-04-02T08:00:00Z',
      companyId: 'co-yge',
      actorUserId: null,
      action: 'import',
      entityType: 'DirRateSchedule',
      entityId: 'dir-2026-04',
    });
    expect(e.actorUserId).toBeNull();
  });
});
