import { describe, expect, it } from 'vitest';
import { buildEquipmentServiceBoard } from './equipment-service';
import type { Equipment } from './equipment';

function eq(over: Partial<Equipment>): Equipment {
  return {
    id: 'eq-1',
    createdAt: '',
    updatedAt: '',
    name: 'CAT D6T',
    category: 'DOZER',
    usageMetric: 'HOURS',
    currentUsage: 0,
    status: 'IN_YARD',
    maintenanceLog: [],
    ...over,
  } as Equipment;
}

describe('buildEquipmentServiceBoard', () => {
  it('flags OVERDUE when usage since service > interval', () => {
    const r = buildEquipmentServiceBoard({
      equipment: [
        eq({
          currentUsage: 1300,
          lastServiceUsage: 1000,
          serviceIntervalUsage: 250,
        }),
      ],
    });
    const row = r.rows[0]!;
    expect(row.usageSinceService).toBe(300);
    expect(row.usageUntilDue).toBe(-50);
    expect(row.flag).toBe('OVERDUE');
  });

  it('flags DUE_SOON at >=90% of interval', () => {
    const r = buildEquipmentServiceBoard({
      equipment: [
        eq({
          currentUsage: 1230, // 230 since service of 1000 → 92% of 250
          lastServiceUsage: 1000,
          serviceIntervalUsage: 250,
        }),
      ],
    });
    expect(r.rows[0]?.flag).toBe('DUE_SOON');
    expect(r.rows[0]?.fractionOfInterval).toBeGreaterThan(0.9);
  });

  it('flags OK at <90% of interval', () => {
    const r = buildEquipmentServiceBoard({
      equipment: [
        eq({
          currentUsage: 1100, // 100 since service → 40%
          lastServiceUsage: 1000,
          serviceIntervalUsage: 250,
        }),
      ],
    });
    expect(r.rows[0]?.flag).toBe('OK');
  });

  it('flags NO_SCHEDULE when serviceIntervalUsage is missing', () => {
    const r = buildEquipmentServiceBoard({
      equipment: [
        eq({ currentUsage: 5000, serviceIntervalUsage: undefined }),
      ],
    });
    expect(r.rows[0]?.flag).toBe('NO_SCHEDULE');
    expect(r.rows[0]?.usageUntilDue).toBeNull();
  });

  it('uses the most recent maintenance log entry as last service', () => {
    const r = buildEquipmentServiceBoard({
      equipment: [
        eq({
          currentUsage: 1500,
          lastServiceUsage: 100, // stale fallback
          serviceIntervalUsage: 250,
          maintenanceLog: [
            {
              performedAt: '2026-01-15T10:00:00Z',
              usageAtService: 800,
              kind: 'OIL_CHANGE',
              description: 'oil change',
            },
            {
              performedAt: '2026-04-10T10:00:00Z',
              usageAtService: 1300,
              kind: 'OIL_CHANGE',
              description: 'oil change',
            },
          ] as never,
        }),
      ],
    });
    const row = r.rows[0]!;
    expect(row.lastServiceUsage).toBe(1300);
    expect(row.lastServiceDate).toBe('2026-04-10');
    expect(row.usageSinceService).toBe(200);
    expect(row.flag).toBe('OK'); // 200/250 = 80%, below DUE_SOON threshold
  });

  it('handles empty log + lastServiceUsage fallback', () => {
    const r = buildEquipmentServiceBoard({
      equipment: [
        eq({
          currentUsage: 600,
          lastServiceUsage: 500,
          serviceIntervalUsage: 250,
          maintenanceLog: [],
        }),
      ],
    });
    expect(r.rows[0]?.lastServiceUsage).toBe(500);
    expect(r.rows[0]?.lastServiceDate).toBeNull();
    expect(r.rows[0]?.usageSinceService).toBe(100);
    expect(r.rows[0]?.flag).toBe('OK');
  });

  it('honors a custom dueSoonThreshold', () => {
    const r = buildEquipmentServiceBoard({
      equipment: [
        eq({
          currentUsage: 1175, // 70% of interval
          lastServiceUsage: 1000,
          serviceIntervalUsage: 250,
        }),
      ],
      dueSoonThreshold: 0.6,
    });
    expect(r.rows[0]?.flag).toBe('DUE_SOON');
  });

  it('sorts OVERDUE first (most overdue first), then DUE_SOON (highest %), then OK', () => {
    const r = buildEquipmentServiceBoard({
      equipment: [
        eq({
          id: 'a',
          name: 'OK Truck',
          currentUsage: 100,
          serviceIntervalUsage: 1000,
        }),
        eq({
          id: 'b',
          name: 'Slightly Overdue',
          currentUsage: 1100,
          lastServiceUsage: 1000,
          serviceIntervalUsage: 50,
        }),
        eq({
          id: 'c',
          name: 'Way Overdue',
          currentUsage: 2000,
          lastServiceUsage: 1000,
          serviceIntervalUsage: 50,
        }),
        eq({
          id: 'd',
          name: 'Due Soon',
          currentUsage: 1240,
          lastServiceUsage: 1000,
          serviceIntervalUsage: 250,
        }),
      ],
    });
    expect(r.rows.map((x) => x.equipmentId)).toEqual(['c', 'b', 'd', 'a']);
  });

  it('rollup counts each tier', () => {
    const r = buildEquipmentServiceBoard({
      equipment: [
        eq({ id: 'a', currentUsage: 1300, lastServiceUsage: 1000, serviceIntervalUsage: 250 }), // OVERDUE
        eq({ id: 'b', currentUsage: 1230, lastServiceUsage: 1000, serviceIntervalUsage: 250 }), // DUE_SOON
        eq({ id: 'c', currentUsage: 1100, lastServiceUsage: 1000, serviceIntervalUsage: 250 }), // OK
        eq({ id: 'd', currentUsage: 5000, serviceIntervalUsage: undefined }),                    // NO_SCHEDULE
      ],
    });
    expect(r.rollup.total).toBe(4);
    expect(r.rollup.overdue).toBe(1);
    expect(r.rollup.dueSoon).toBe(1);
    expect(r.rollup.ok).toBe(1);
    expect(r.rollup.noSchedule).toBe(1);
  });
});
