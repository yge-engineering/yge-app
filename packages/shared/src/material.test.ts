import { describe, expect, it } from 'vitest';
import {
  applyMovement,
  computeInventoryRollup,
  inventoryValuationCents,
  isBelowReorder,
  recomputeQuantityOnHand,
  type Material,
  type StockMovement,
} from './material';

function mat(over: Partial<Material>): Material {
  return {
    id: 'mat-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
    name: 'Test Material',
    category: 'OTHER',
    unit: 'EA',
    quantityOnHand: 0,
    movements: [],
    ...over,
  };
}

function mov(over: Partial<StockMovement>): StockMovement {
  return {
    id: 'mov-aaaaaaaa',
    recordedAt: '2026-04-01T00:00:00Z',
    kind: 'RECEIVED',
    quantity: 1,
    ...over,
  };
}

describe('applyMovement', () => {
  it('adds for RECEIVED + RETURNED', () => {
    expect(applyMovement(10, mov({ kind: 'RECEIVED', quantity: 5 }))).toBe(15);
    expect(applyMovement(10, mov({ kind: 'RETURNED', quantity: 5 }))).toBe(15);
  });

  it('subtracts for CONSUMED + TRANSFERRED, clamped at 0', () => {
    expect(applyMovement(10, mov({ kind: 'CONSUMED', quantity: 3 }))).toBe(7);
    expect(applyMovement(2, mov({ kind: 'CONSUMED', quantity: 5 }))).toBe(0);
    expect(applyMovement(10, mov({ kind: 'TRANSFERRED', quantity: 4 }))).toBe(6);
  });

  it('sets the value to the quantity for ADJUSTED', () => {
    expect(applyMovement(10, mov({ kind: 'ADJUSTED', quantity: 99 }))).toBe(99);
  });
});

describe('recomputeQuantityOnHand', () => {
  it('replays the movement ledger from zero', () => {
    const ledger: StockMovement[] = [
      mov({ kind: 'RECEIVED', quantity: 100 }),
      mov({ kind: 'CONSUMED', quantity: 30 }),
      mov({ kind: 'CONSUMED', quantity: 20 }),
      mov({ kind: 'RETURNED', quantity: 5 }),
      mov({ kind: 'ADJUSTED', quantity: 50 }), // physical count corrected to 50
      mov({ kind: 'CONSUMED', quantity: 10 }),
    ];
    expect(recomputeQuantityOnHand(ledger)).toBe(40);
  });
});

describe('isBelowReorder', () => {
  it('returns true at or below the reorder point', () => {
    expect(isBelowReorder(mat({ quantityOnHand: 5, reorderPoint: 10 }))).toBe(true);
    expect(isBelowReorder(mat({ quantityOnHand: 10, reorderPoint: 10 }))).toBe(true);
    expect(isBelowReorder(mat({ quantityOnHand: 11, reorderPoint: 10 }))).toBe(false);
  });

  it('returns false when no reorder point configured', () => {
    expect(isBelowReorder(mat({ quantityOnHand: 0 }))).toBe(false);
  });
});

describe('inventoryValuationCents', () => {
  it('sums quantity * unit cost across materials', () => {
    const v = inventoryValuationCents([
      mat({ quantityOnHand: 10, unitCostCents: 5_00 }),
      mat({ quantityOnHand: 4, unitCostCents: 100_00 }),
      mat({ quantityOnHand: 100 }), // no unitCostCents — skipped
    ]);
    // 10*$5 + 4*$100 = $450
    expect(v).toBe(450_00);
  });
});

describe('computeInventoryRollup', () => {
  const fixtures: Material[] = [
    mat({ category: 'REBAR', quantityOnHand: 100, reorderPoint: 50, unitCostCents: 200 }),
    mat({ category: 'REBAR', quantityOnHand: 30, reorderPoint: 50, unitCostCents: 200 }), // below
    mat({ category: 'AGGREGATE', quantityOnHand: 0, unitCostCents: 1_00 }), // out of stock
    mat({ category: 'CONCRETE', quantityOnHand: 5 }), // no cost
  ];

  it('counts below-reorder + out-of-stock buckets', () => {
    const r = computeInventoryRollup(fixtures);
    expect(r.total).toBe(4);
    expect(r.belowReorder).toBe(1);
    expect(r.outOfStock).toBe(1);
  });

  it('groups by category', () => {
    const r = computeInventoryRollup(fixtures);
    expect(r.byCategory.find((b) => b.category === 'REBAR')?.count).toBe(2);
  });

  it('rolls up valuation from materials with unit cost', () => {
    const r = computeInventoryRollup(fixtures);
    // 100 * $2 + 30 * $2 = $260, the rest skipped
    expect(r.valuationCents).toBe(260_00);
  });
});
