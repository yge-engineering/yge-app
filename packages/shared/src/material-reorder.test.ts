import { describe, expect, it } from 'vitest';
import { buildMaterialReorderReport } from './material-reorder';
import type { Material, StockMovement } from './material';

function mat(over: Partial<Material>, movements: Partial<StockMovement>[] = []): Material {
  return {
    id: 'mat-1',
    createdAt: '',
    updatedAt: '',
    name: 'Item',
    category: 'OTHER',
    unit: 'EA',
    quantityOnHand: 100,
    movements: movements.map(
      (m) =>
        ({
          id: 'mv-1',
          recordedAt: '2026-04-15T00:00:00Z',
          kind: 'CONSUMED',
          quantity: 0,
          ...m,
        }) as StockMovement,
    ),
    ...over,
  } as Material;
}

describe('buildMaterialReorderReport', () => {
  it('flags OUT when quantityOnHand <= 0', () => {
    const r = buildMaterialReorderReport({
      asOf: '2026-04-27',
      materials: [mat({ id: 'a', quantityOnHand: 0, reorderPoint: 5 })],
    });
    expect(r.rows[0]?.tier).toBe('OUT');
  });

  it('flags BELOW_REORDER when at or below reorderPoint', () => {
    const r = buildMaterialReorderReport({
      asOf: '2026-04-27',
      materials: [
        mat({ id: 'a', quantityOnHand: 5, reorderPoint: 10 }),
        mat({ id: 'b', quantityOnHand: 10, reorderPoint: 10 }),
      ],
    });
    expect(r.rows.every((x) => x.tier === 'BELOW_REORDER')).toBe(true);
  });

  it('flags RUNWAY_LT_7D when velocity says <7 days even above reorder', () => {
    const r = buildMaterialReorderReport({
      asOf: '2026-04-27',
      materials: [
        mat(
          { id: 'a', quantityOnHand: 30, reorderPoint: 10 },
          [
            // 90 days of consumption: 90 × 5 = 450 units → 5/day
            { kind: 'CONSUMED', quantity: 450, recordedAt: '2026-03-01T00:00:00Z' },
          ],
        ),
      ],
    });
    // 30 / 5 = 6 days runway → <7
    expect(r.rows[0]?.tier).toBe('RUNWAY_LT_7D');
  });

  it('flags OK when stock is well above reorder + runway > 7 days', () => {
    const r = buildMaterialReorderReport({
      asOf: '2026-04-27',
      materials: [
        mat(
          { id: 'a', quantityOnHand: 1000, reorderPoint: 10 },
          [{ kind: 'CONSUMED', quantity: 90, recordedAt: '2026-03-01T00:00:00Z' }],
        ),
      ],
    });
    expect(r.rows[0]?.tier).toBe('OK');
  });

  it('only counts CONSUMED movements in the window for velocity', () => {
    const r = buildMaterialReorderReport({
      asOf: '2026-04-27',
      velocityWindowDays: 90,
      materials: [
        mat(
          { id: 'a', quantityOnHand: 100, reorderPoint: 10 },
          [
            { kind: 'CONSUMED', quantity: 50, recordedAt: '2026-03-15T00:00:00Z' }, // in
            { kind: 'CONSUMED', quantity: 99, recordedAt: '2025-12-01T00:00:00Z' }, // out of window
            { kind: 'RECEIVED', quantity: 200, recordedAt: '2026-03-20T00:00:00Z' }, // not consumed
            { kind: 'RETURNED', quantity: 5, recordedAt: '2026-03-25T00:00:00Z' }, // not consumed
          ],
        ),
      ],
    });
    expect(r.rows[0]?.consumedInWindow).toBe(50);
    // 50 / 90 ≈ 0.555 per day
    expect(r.rows[0]?.consumptionPerDay).toBeCloseTo(50 / 90, 4);
  });

  it('daysOfStockRemaining is null when no consumption', () => {
    const r = buildMaterialReorderReport({
      asOf: '2026-04-27',
      materials: [mat({ id: 'a', quantityOnHand: 50, reorderPoint: 10 })],
    });
    expect(r.rows[0]?.daysOfStockRemaining).toBeNull();
  });

  it('carryingValueCents = quantity × unitCost', () => {
    const r = buildMaterialReorderReport({
      asOf: '2026-04-27',
      materials: [
        mat({ id: 'a', quantityOnHand: 12, unitCostCents: 250_00, reorderPoint: 5 }),
      ],
    });
    expect(r.rows[0]?.carryingValueCents).toBe(12 * 250_00);
  });

  it('sorts OUT first, then BELOW, then RUNWAY (smallest runway first), then OK', () => {
    const r = buildMaterialReorderReport({
      asOf: '2026-04-27',
      materials: [
        mat({ id: 'ok', quantityOnHand: 1000, reorderPoint: 10 }, [
          { kind: 'CONSUMED', quantity: 90, recordedAt: '2026-03-01T00:00:00Z' },
        ]),
        mat({ id: 'out', quantityOnHand: 0, reorderPoint: 5 }),
        mat({ id: 'below', quantityOnHand: 5, reorderPoint: 10 }),
        mat({ id: 'runway', quantityOnHand: 30, reorderPoint: 5 }, [
          { kind: 'CONSUMED', quantity: 540, recordedAt: '2026-03-01T00:00:00Z' }, // 6/day → 5 day runway
        ]),
      ],
    });
    expect(r.rows.map((x) => x.materialId)).toEqual([
      'out',
      'below',
      'runway',
      'ok',
    ]);
  });

  it('rollup tallies tiers and total carrying value', () => {
    const r = buildMaterialReorderReport({
      asOf: '2026-04-27',
      materials: [
        mat({ id: 'a', quantityOnHand: 0, unitCostCents: 100_00, reorderPoint: 1 }),
        mat({ id: 'b', quantityOnHand: 5, unitCostCents: 100_00, reorderPoint: 10 }),
        mat({ id: 'c', quantityOnHand: 20, unitCostCents: 100_00, reorderPoint: 5 }, [
          { kind: 'CONSUMED', quantity: 360, recordedAt: '2026-03-01T00:00:00Z' }, // 4/day → 5 day runway
        ]),
        mat({ id: 'd', quantityOnHand: 100, unitCostCents: 100_00, reorderPoint: 5 }),
      ],
    });
    expect(r.rollup.out).toBe(1);
    expect(r.rollup.belowReorder).toBe(1);
    expect(r.rollup.shortRunway).toBe(1);
    expect(r.rollup.ok).toBe(1);
    expect(r.rollup.totalCarryingValueCents).toBe(
      (0 + 5 + 20 + 100) * 100_00,
    );
  });
});
