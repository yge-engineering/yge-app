import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { Material, StockMovement } from './material';

import { buildJobStockConsumption } from './job-stock-consumption';

function job(over: Partial<Pick<Job, 'id' | 'projectName' | 'status'>>): Pick<
  Job,
  'id' | 'projectName' | 'status'
> {
  return {
    id: 'j1',
    projectName: 'Sulphur Springs',
    status: 'AWARDED',
    ...over,
  };
}

function mv(over: Partial<StockMovement>): StockMovement {
  return {
    id: 'mv-1',
    recordedAt: '2026-04-15T00:00:00.000Z',
    kind: 'CONSUMED',
    quantity: 10,
    jobId: 'j1',
    ...over,
  } as StockMovement;
}

function mat(over: Partial<Material> & Pick<Material, 'name' | 'category'>): Material {
  return {
    id: 'm-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    unit: 'TON',
    quantityOnHand: 0,
    movements: [],
    ...over,
  } as Material;
}

describe('buildJobStockConsumption', () => {
  it('sums consumed quantity × unitCost into consumedCostCents', () => {
    const r = buildJobStockConsumption({
      jobs: [job({})],
      materials: [
        mat({
          name: 'Class 2 base',
          category: 'AGGREGATE',
          unitCostCents: 50_00, // $50/ton
          movements: [
            mv({ id: 'a', quantity: 100 }),
            mv({ id: 'b', quantity: 50 }),
          ],
        }),
      ],
    });
    // 150 tons × $50 = $7,500
    expect(r.rows[0]?.totalConsumedCostCents).toBe(7_500_00);
    expect(r.rows[0]?.distinctMaterials).toBe(1);
  });

  it('rolls up by category', () => {
    const r = buildJobStockConsumption({
      jobs: [job({})],
      materials: [
        mat({
          id: 'm1', name: 'Base', category: 'AGGREGATE', unitCostCents: 50_00,
          movements: [mv({ id: 'a', quantity: 100 })],
        }),
        mat({
          id: 'm2', name: 'Mix', category: 'CONCRETE', unitCostCents: 100_00,
          movements: [mv({ id: 'b', quantity: 20 })],
        }),
        mat({
          id: 'm3', name: 'Drain rock', category: 'AGGREGATE', unitCostCents: 60_00,
          movements: [mv({ id: 'c', quantity: 10 })],
        }),
      ],
    });
    const cats = r.rows[0]?.byCategory ?? [];
    const agg = cats.find((c) => c.category === 'AGGREGATE');
    const con = cats.find((c) => c.category === 'CONCRETE');
    expect(agg?.consumedCostCents).toBe(5_600_00); // 100*50 + 10*60
    expect(agg?.materialCount).toBe(2);
    expect(con?.consumedCostCents).toBe(2_000_00); // 20*100
  });

  it('skips non-CONSUMED movements', () => {
    const r = buildJobStockConsumption({
      jobs: [job({})],
      materials: [
        mat({
          name: 'Base', category: 'AGGREGATE', unitCostCents: 50_00,
          movements: [
            mv({ id: 'a', kind: 'CONSUMED', quantity: 50 }),
            mv({ id: 'b', kind: 'RECEIVED', quantity: 100 }),
            mv({ id: 'c', kind: 'RETURNED', quantity: 10 }),
            mv({ id: 'd', kind: 'ADJUSTED', quantity: 5 }),
          ],
        }),
      ],
    });
    expect(r.rows[0]?.materials[0]?.consumedQuantity).toBe(50);
  });

  it('skips movements with no jobId', () => {
    const r = buildJobStockConsumption({
      jobs: [job({})],
      materials: [
        mat({
          name: 'Base', category: 'AGGREGATE', unitCostCents: 50_00,
          movements: [
            mv({ id: 'tagged', quantity: 100 }),
            mv({ id: 'untagged', quantity: 50, jobId: undefined }),
          ],
        }),
      ],
    });
    expect(r.rows[0]?.materials[0]?.consumedQuantity).toBe(100);
  });

  it('flags missing unitCost in rollup', () => {
    const r = buildJobStockConsumption({
      jobs: [job({})],
      materials: [
        mat({
          name: 'Base', category: 'AGGREGATE', unitCostCents: undefined,
          movements: [mv({ quantity: 100 })],
        }),
      ],
    });
    expect(r.rows[0]?.unitCostMissingCount).toBe(1);
    expect(r.rows[0]?.totalConsumedCostCents).toBe(0);
    expect(r.rows[0]?.materials[0]?.unitCostCents).toBe(null);
  });

  it('respects fromDate/toDate window', () => {
    const r = buildJobStockConsumption({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      jobs: [job({})],
      materials: [
        mat({
          name: 'Base', category: 'AGGREGATE', unitCostCents: 50_00,
          movements: [
            mv({ id: 'old', quantity: 100, recordedAt: '2026-03-15T00:00:00.000Z' }),
            mv({ id: 'in', quantity: 100, recordedAt: '2026-04-15T00:00:00.000Z' }),
            mv({ id: 'after', quantity: 100, recordedAt: '2026-05-15T00:00:00.000Z' }),
          ],
        }),
      ],
    });
    expect(r.rows[0]?.materials[0]?.consumedQuantity).toBe(100);
  });

  it('skips non-AWARDED jobs by default', () => {
    const r = buildJobStockConsumption({
      jobs: [
        job({ id: 'p', status: 'PROSPECT' }),
        job({ id: 'a' }),
      ],
      materials: [],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.jobId).toBe('a');
  });

  it('sorts materials by cost desc within job', () => {
    const r = buildJobStockConsumption({
      jobs: [job({})],
      materials: [
        mat({ id: 'cheap', name: 'A', category: 'AGGREGATE', unitCostCents: 10_00,
          movements: [mv({ id: 'a', quantity: 1 })] }),
        mat({ id: 'pricey', name: 'B', category: 'AGGREGATE', unitCostCents: 1000_00,
          movements: [mv({ id: 'b', quantity: 5 })] }),
      ],
    });
    expect(r.rows[0]?.materials[0]?.materialId).toBe('pricey');
  });

  it('sorts jobs by total cost desc', () => {
    const r = buildJobStockConsumption({
      jobs: [
        job({ id: 'small' }),
        job({ id: 'big' }),
      ],
      materials: [
        mat({ id: 'm', name: 'Base', category: 'AGGREGATE', unitCostCents: 50_00,
          movements: [
            mv({ id: 'small', jobId: 'small', quantity: 10 }),
            mv({ id: 'big', jobId: 'big', quantity: 100 }),
          ]}),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('big');
    expect(r.rows[1]?.jobId).toBe('small');
  });

  it('handles empty input', () => {
    const r = buildJobStockConsumption({ jobs: [], materials: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalConsumedCostCents).toBe(0);
  });
});
