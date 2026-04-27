import { describe, expect, it } from 'vitest';

import type { Material, StockMovement } from './material';

import { buildSlowMoverReport } from './material-slow-mover';

function mat(over: Partial<Material>): Material {
  return {
    id: 'mat-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    name: 'Class 2 Aggregate Base',
    category: 'AGGREGATE',
    unit: 'TON',
    quantityOnHand: 100,
    unitCostCents: 25_00,
    movements: [],
    ...over,
  } as Material;
}

function mv(over: Partial<StockMovement>): StockMovement {
  return {
    id: 'mv-1',
    recordedAt: '2026-04-01T00:00:00.000Z',
    kind: 'CONSUMED',
    quantity: 5,
    ...over,
  } as StockMovement;
}

describe('buildSlowMoverReport', () => {
  it('skips materials with zero quantity on hand', () => {
    const r = buildSlowMoverReport({
      asOf: '2026-04-27',
      materials: [mat({ quantityOnHand: 0 })],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('classifies FRESH (<90 days since last CONSUMED)', () => {
    const r = buildSlowMoverReport({
      asOf: '2026-04-27',
      materials: [
        mat({ movements: [mv({ recordedAt: '2026-03-01T00:00:00.000Z' })] }),
      ],
    });
    expect(r.rows[0]?.flag).toBe('FRESH');
    expect(r.rows[0]?.daysSinceLastUse).toBe(57);
  });

  it('classifies SLOWING (90-179 days)', () => {
    const r = buildSlowMoverReport({
      asOf: '2026-04-27',
      materials: [
        mat({ movements: [mv({ recordedAt: '2025-12-15T00:00:00.000Z' })] }),
      ],
    });
    expect(r.rows[0]?.flag).toBe('SLOWING');
  });

  it('classifies SLOW (180-364 days)', () => {
    const r = buildSlowMoverReport({
      asOf: '2026-04-27',
      materials: [
        mat({ movements: [mv({ recordedAt: '2025-08-01T00:00:00.000Z' })] }),
      ],
    });
    expect(r.rows[0]?.flag).toBe('SLOW');
  });

  it('classifies STALE (365+ days)', () => {
    const r = buildSlowMoverReport({
      asOf: '2026-04-27',
      materials: [
        mat({ movements: [mv({ recordedAt: '2024-01-01T00:00:00.000Z' })] }),
      ],
    });
    expect(r.rows[0]?.flag).toBe('STALE');
  });

  it('classifies STALE when there are no CONSUMED/RETURNED movements at all', () => {
    const r = buildSlowMoverReport({
      asOf: '2026-04-27',
      materials: [mat({ movements: [] })],
    });
    expect(r.rows[0]?.flag).toBe('STALE');
    expect(r.rows[0]?.daysSinceLastUse).toBe(null);
    expect(r.rows[0]?.lastUsedAt).toBe(null);
  });

  it('ignores RECEIVED and ADJUSTED movements when computing last-used', () => {
    const r = buildSlowMoverReport({
      asOf: '2026-04-27',
      materials: [
        mat({
          movements: [
            mv({ id: 'mv-1', kind: 'RECEIVED', recordedAt: '2026-04-25T00:00:00.000Z' }),
            mv({ id: 'mv-2', kind: 'CONSUMED', recordedAt: '2024-06-01T00:00:00.000Z' }),
            mv({ id: 'mv-3', kind: 'ADJUSTED', recordedAt: '2026-04-20T00:00:00.000Z' }),
          ],
        }),
      ],
    });
    // Only the CONSUMED movement counts → STALE
    expect(r.rows[0]?.flag).toBe('STALE');
  });

  it('counts RETURNED movements as use', () => {
    const r = buildSlowMoverReport({
      asOf: '2026-04-27',
      materials: [
        mat({
          movements: [
            mv({ id: 'mv-1', kind: 'RETURNED', recordedAt: '2026-03-01T00:00:00.000Z' }),
          ],
        }),
      ],
    });
    expect(r.rows[0]?.flag).toBe('FRESH');
  });

  it('computes inventory value as quantityOnHand * unitCostCents', () => {
    const r = buildSlowMoverReport({
      asOf: '2026-04-27',
      materials: [
        mat({ quantityOnHand: 50, unitCostCents: 100_00 }),
      ],
    });
    expect(r.rows[0]?.inventoryValueCents).toBe(5_000_00);
  });

  it('rolls up stale-capital across SLOW + STALE only', () => {
    const r = buildSlowMoverReport({
      asOf: '2026-04-27',
      materials: [
        // FRESH — does not count
        mat({
          id: 'mat-1',
          quantityOnHand: 10,
          unitCostCents: 100_00,
          movements: [mv({ recordedAt: '2026-04-15T00:00:00.000Z' })],
        }),
        // SLOW — counts
        mat({
          id: 'mat-2',
          quantityOnHand: 5,
          unitCostCents: 200_00,
          movements: [mv({ recordedAt: '2025-09-01T00:00:00.000Z' })],
        }),
        // STALE — counts
        mat({
          id: 'mat-3',
          quantityOnHand: 2,
          unitCostCents: 500_00,
          movements: [],
        }),
      ],
    });
    // SLOW: 5 * 200_00 = 1_000_00; STALE: 2 * 500_00 = 1_000_00 → 2_000_00
    expect(r.rollup.staleCapitalCents).toBe(2_000_00);
    expect(r.rollup.fresh).toBe(1);
    expect(r.rollup.slow).toBe(1);
    expect(r.rollup.stale).toBe(1);
  });

  it('sorts STALE first, then by days-since-last-use desc', () => {
    const r = buildSlowMoverReport({
      asOf: '2026-04-27',
      materials: [
        mat({ id: 'mat-fresh', movements: [mv({ recordedAt: '2026-04-20T00:00:00.000Z' })] }),
        mat({ id: 'mat-stale-newer', movements: [mv({ recordedAt: '2024-12-01T00:00:00.000Z' })] }),
        mat({ id: 'mat-stale-older', movements: [mv({ recordedAt: '2024-06-01T00:00:00.000Z' })] }),
      ],
    });
    expect(r.rows[0]?.materialId).toBe('mat-stale-older');
    expect(r.rows[1]?.materialId).toBe('mat-stale-newer');
    expect(r.rows[2]?.materialId).toBe('mat-fresh');
  });
});
