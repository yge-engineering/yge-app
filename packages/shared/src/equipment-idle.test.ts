import { describe, expect, it } from 'vitest';
import { buildEquipmentIdleReport } from './equipment-idle';
import type { Dispatch } from './dispatch';
import type { Equipment } from './equipment';

function eq(over: Partial<Equipment>): Equipment {
  return {
    id: 'eq-1',
    createdAt: '',
    updatedAt: '',
    name: 'Cat D6T',
    category: 'DOZER',
    usageMetric: 'HOURS',
    currentUsage: 0,
    status: 'IN_YARD',
    maintenanceLog: [],
    ...over,
  } as Equipment;
}

function dispatch(over: Partial<Dispatch>): Dispatch {
  return {
    id: 'disp-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'job-1',
    scheduledFor: '2026-04-15',
    foremanName: 'Bob',
    scopeOfWork: 'Move dirt',
    crew: [],
    equipment: [],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

describe('buildEquipmentIdleReport', () => {
  it('NEVER_USED when no matching dispatch', () => {
    const r = buildEquipmentIdleReport({
      asOf: '2026-04-27',
      equipment: [eq({ id: 'eq-A' })],
      dispatches: [],
    });
    expect(r.rows[0]?.tier).toBe('NEVER_USED');
    expect(r.rows[0]?.idleDays).toBeNull();
  });

  it('IN_USE within last 7 days', () => {
    const r = buildEquipmentIdleReport({
      asOf: '2026-04-27',
      equipment: [eq({ id: 'eq-A' })],
      dispatches: [
        dispatch({
          scheduledFor: '2026-04-25',
          equipment: [{ equipmentId: 'eq-A', name: 'D6T' } as never],
        }),
      ],
    });
    expect(r.rows[0]?.tier).toBe('IN_USE');
    expect(r.rows[0]?.idleDays).toBe(2);
  });

  it('IN_USE when status is ASSIGNED regardless of dispatch age', () => {
    const r = buildEquipmentIdleReport({
      asOf: '2026-04-27',
      equipment: [eq({ id: 'eq-A', status: 'ASSIGNED' })],
      dispatches: [
        dispatch({
          scheduledFor: '2026-01-01',
          equipment: [{ equipmentId: 'eq-A', name: 'D6T' } as never],
        }),
      ],
    });
    expect(r.rows[0]?.tier).toBe('IN_USE');
  });

  it('IDLE_30 / IDLE_60 / IDLE_90 / IDLE_LONG bucketing', () => {
    const r = buildEquipmentIdleReport({
      asOf: '2026-04-27',
      equipment: [
        eq({ id: '30' }),
        eq({ id: '60' }),
        eq({ id: '90' }),
        eq({ id: 'long' }),
      ],
      dispatches: [
        dispatch({ id: 'd1', scheduledFor: '2026-04-10', equipment: [{ equipmentId: '30', name: 'a' } as never] }),  // 17 idle
        dispatch({ id: 'd2', scheduledFor: '2026-03-01', equipment: [{ equipmentId: '60', name: 'b' } as never] }),  // 57 idle
        dispatch({ id: 'd3', scheduledFor: '2026-02-01', equipment: [{ equipmentId: '90', name: 'c' } as never] }),  // 85 idle
        dispatch({ id: 'd4', scheduledFor: '2026-01-01', equipment: [{ equipmentId: 'long', name: 'd' } as never] }), // 116 idle
      ],
    });
    const tiers = new Map(r.rows.map((x) => [x.equipmentId, x.tier]));
    expect(tiers.get('30')).toBe('IDLE_30');
    expect(tiers.get('60')).toBe('IDLE_60');
    expect(tiers.get('90')).toBe('IDLE_90');
    expect(tiers.get('long')).toBe('IDLE_LONG');
  });

  it('matches by equipmentId AND falls back to name', () => {
    const r = buildEquipmentIdleReport({
      asOf: '2026-04-27',
      equipment: [eq({ id: 'eq-A', name: 'CAT 320E' })],
      dispatches: [
        dispatch({
          scheduledFor: '2026-04-25',
          equipment: [{ name: 'CAT 320E' } as never], // no equipmentId, name match
        }),
      ],
    });
    expect(r.rows[0]?.tier).toBe('IN_USE');
    expect(r.rows[0]?.dispatchCount).toBe(1);
  });

  it('skips DRAFT and CANCELLED dispatches', () => {
    const r = buildEquipmentIdleReport({
      asOf: '2026-04-27',
      equipment: [eq({ id: 'eq-A' })],
      dispatches: [
        dispatch({
          id: '1',
          status: 'DRAFT',
          scheduledFor: '2026-04-25',
          equipment: [{ equipmentId: 'eq-A', name: 'a' } as never],
        }),
        dispatch({
          id: '2',
          status: 'CANCELLED',
          scheduledFor: '2026-04-25',
          equipment: [{ equipmentId: 'eq-A', name: 'a' } as never],
        }),
      ],
    });
    expect(r.rows[0]?.tier).toBe('NEVER_USED');
  });

  it('rollup tallies tiers', () => {
    const r = buildEquipmentIdleReport({
      asOf: '2026-04-27',
      equipment: [
        eq({ id: 'a' }),
        eq({ id: 'b' }),
        eq({ id: 'c' }),
      ],
      dispatches: [
        dispatch({ id: 'd1', scheduledFor: '2026-04-25', equipment: [{ equipmentId: 'a', name: 'A' } as never] }),
        dispatch({ id: 'd2', scheduledFor: '2026-01-01', equipment: [{ equipmentId: 'b', name: 'B' } as never] }),
      ],
    });
    expect(r.rollup.inUse).toBe(1);
    expect(r.rollup.idleLong).toBe(1);
    expect(r.rollup.neverUsed).toBe(1);
  });

  it('sorts longest-idle first, IN_USE last', () => {
    const r = buildEquipmentIdleReport({
      asOf: '2026-04-27',
      equipment: [
        eq({ id: 'inuse' }),
        eq({ id: 'idle90' }),
        eq({ id: 'long' }),
      ],
      dispatches: [
        dispatch({ id: 'd1', scheduledFor: '2026-04-25', equipment: [{ equipmentId: 'inuse', name: 'A' } as never] }),
        dispatch({ id: 'd2', scheduledFor: '2026-02-01', equipment: [{ equipmentId: 'idle90', name: 'B' } as never] }),
        dispatch({ id: 'd3', scheduledFor: '2025-12-01', equipment: [{ equipmentId: 'long', name: 'C' } as never] }),
      ],
    });
    expect(r.rows.map((x) => x.equipmentId)).toEqual([
      'long',
      'idle90',
      'inuse',
    ]);
  });
});
