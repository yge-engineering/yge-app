import { describe, expect, it } from 'vitest';

import type { Equipment, MaintenanceLogEntry } from './equipment';

import { buildEquipmentFleetAge } from './equipment-fleet-age';

function eq(over: Partial<Equipment>): Equipment {
  return {
    id: 'eq-1',
    createdAt: '2020-01-01T00:00:00.000Z',
    updatedAt: '2020-01-01T00:00:00.000Z',
    name: 'Cat D6T',
    category: 'DOZER',
    usageMetric: 'HOURS',
    currentUsage: 5_000,
    status: 'IN_YARD',
    maintenanceLog: [],
    ...over,
  } as Equipment;
}

function ml(over: Partial<MaintenanceLogEntry>): MaintenanceLogEntry {
  return {
    performedAt: '2026-04-01T00:00:00.000Z',
    usageAtService: 4_500,
    kind: 'OIL_CHANGE',
    description: 'oil + filters',
    costCents: 1_000_00,
    ...over,
  } as MaintenanceLogEntry;
}

describe('buildEquipmentFleetAge', () => {
  it('skips RETIRED and SOLD units', () => {
    const r = buildEquipmentFleetAge({
      asOf: '2026-04-27',
      equipment: [
        eq({ id: 'eq-r', status: 'RETIRED' }),
        eq({ id: 'eq-s', status: 'SOLD' }),
      ],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('classifies YOUNG (<50% of useful life)', () => {
    // DOZER useful life = 15_000 hours. 5_000 = 33%
    const r = buildEquipmentFleetAge({
      asOf: '2026-04-27',
      equipment: [eq({ category: 'DOZER', currentUsage: 5_000 })],
    });
    expect(r.rows[0]?.flag).toBe('YOUNG');
  });

  it('classifies MATURE (50-79%)', () => {
    // DOZER 9_000 = 60%
    const r = buildEquipmentFleetAge({
      asOf: '2026-04-27',
      equipment: [eq({ category: 'DOZER', currentUsage: 9_000 })],
    });
    expect(r.rows[0]?.flag).toBe('MATURE');
  });

  it('classifies AGING (80-100%)', () => {
    // DOZER 13_000 = 87%
    const r = buildEquipmentFleetAge({
      asOf: '2026-04-27',
      equipment: [eq({ category: 'DOZER', currentUsage: 13_000 })],
    });
    expect(r.rows[0]?.flag).toBe('AGING');
  });

  it('classifies OVER_LIFE (100%+)', () => {
    // DOZER 18_000 = 120%
    const r = buildEquipmentFleetAge({
      asOf: '2026-04-27',
      equipment: [eq({ category: 'DOZER', currentUsage: 18_000 })],
    });
    expect(r.rows[0]?.flag).toBe('OVER_LIFE');
    expect(r.rows[0]?.usageLifePct).toBeGreaterThan(1);
  });

  it('uses miles threshold for TRUCK', () => {
    // TRUCK useful life = 250_000 miles. 200_000 = 80% → AGING
    const r = buildEquipmentFleetAge({
      asOf: '2026-04-27',
      equipment: [eq({ category: 'TRUCK', usageMetric: 'MILES', currentUsage: 200_000 })],
    });
    expect(r.rows[0]?.flag).toBe('AGING');
  });

  it('computes age years from model year', () => {
    const r = buildEquipmentFleetAge({
      asOf: '2026-04-27',
      equipment: [eq({ year: 2010 })],
    });
    expect(r.rows[0]?.ageYears).toBe(16);
    expect(r.rows[0]?.modelYear).toBe(2010);
  });

  it('rolls up only maintenance from last 12 months', () => {
    const r = buildEquipmentFleetAge({
      asOf: '2026-04-27',
      equipment: [
        eq({
          maintenanceLog: [
            ml({ performedAt: '2026-03-01T00:00:00.000Z', costCents: 1_000_00 }), // in window
            ml({ performedAt: '2024-06-01T00:00:00.000Z', costCents: 5_000_00 }), // out of window
          ],
        }),
      ],
    });
    expect(r.rows[0]?.recentMaintenanceCents).toBe(1_000_00);
  });

  it('computes maintenance-vs-replacement ratio', () => {
    // DOZER replacement ~ $250K. $50K maintenance = 0.2.
    const r = buildEquipmentFleetAge({
      asOf: '2026-04-27',
      equipment: [
        eq({
          maintenanceLog: [
            ml({ performedAt: '2026-03-01T00:00:00.000Z', costCents: 50_000_00 }),
          ],
        }),
      ],
    });
    expect(r.rows[0]?.maintenanceVsReplacementPct).toBe(0.2);
  });

  it('rolls up totals and tier counts', () => {
    const r = buildEquipmentFleetAge({
      asOf: '2026-04-27',
      equipment: [
        eq({ id: 'eq-young', category: 'DOZER', currentUsage: 1_000 }),
        eq({ id: 'eq-mature', category: 'DOZER', currentUsage: 9_000 }),
        eq({ id: 'eq-aging', category: 'DOZER', currentUsage: 13_000 }),
        eq({ id: 'eq-over', category: 'DOZER', currentUsage: 18_000 }),
      ],
    });
    expect(r.rollup.unitsConsidered).toBe(4);
    expect(r.rollup.young).toBe(1);
    expect(r.rollup.mature).toBe(1);
    expect(r.rollup.aging).toBe(1);
    expect(r.rollup.overLife).toBe(1);
  });

  it('sorts OVER_LIFE first', () => {
    const r = buildEquipmentFleetAge({
      asOf: '2026-04-27',
      equipment: [
        eq({ id: 'eq-young', category: 'DOZER', currentUsage: 1_000 }),
        eq({ id: 'eq-over', category: 'DOZER', currentUsage: 18_000 }),
      ],
    });
    expect(r.rows[0]?.equipmentId).toBe('eq-over');
  });
});
