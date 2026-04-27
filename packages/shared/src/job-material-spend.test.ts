import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Material } from './material';

import { buildJobMaterialSpend } from './job-material-spend';

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    vendorName: 'Acme Supply',
    invoiceDate: '2026-04-01',
    jobId: 'job-1',
    lineItems: [
      {
        description: 'Class 2 base',
        quantity: 100,
        unitPriceCents: 25_00,
        lineTotalCents: 2_500_00,
        costCode: 'AGG-1.5',
      },
    ],
    totalCents: 2_500_00,
    paidCents: 0,
    status: 'APPROVED',
    ...over,
  } as ApInvoice;
}

function mat(over: Partial<Material>): Material {
  return {
    id: 'mat-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    name: 'Class 2 base',
    sku: 'AGG-1.5',
    category: 'AGGREGATE',
    unit: 'TON',
    quantityOnHand: 0,
    movements: [],
    ...over,
  } as Material;
}

describe('buildJobMaterialSpend', () => {
  it('skips DRAFT and REJECTED invoices', () => {
    const r = buildJobMaterialSpend({
      apInvoices: [
        ap({ id: 'ap-1', status: 'DRAFT' }),
        ap({ id: 'ap-2', status: 'REJECTED' }),
      ],
      materials: [mat({})],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('lands all spend in OTHER when no materials supplied', () => {
    const r = buildJobMaterialSpend({
      apInvoices: [ap({})],
    });
    expect(r.rows[0]?.byCategory[0]?.category).toBe('OTHER');
    expect(r.rows[0]?.byCategory[0]?.spendCents).toBe(2_500_00);
  });

  it('maps costCode to material category', () => {
    const r = buildJobMaterialSpend({
      apInvoices: [ap({})],
      materials: [mat({ sku: 'AGG-1.5', category: 'AGGREGATE' })],
    });
    expect(r.rows[0]?.byCategory[0]?.category).toBe('AGGREGATE');
    expect(r.rows[0]?.byCategory[0]?.spendCents).toBe(2_500_00);
  });

  it('rolls up multiple categories per job', () => {
    const r = buildJobMaterialSpend({
      apInvoices: [
        ap({
          id: 'ap-1',
          lineItems: [
            { description: 'base', quantity: 1, unitPriceCents: 0, lineTotalCents: 3_000_00, costCode: 'AGG-1.5' },
            { description: 'rebar', quantity: 1, unitPriceCents: 0, lineTotalCents: 1_000_00, costCode: 'REBAR-4' },
            { description: 'fuel', quantity: 1, unitPriceCents: 0, lineTotalCents: 500_00, costCode: 'DIESEL' },
          ],
        }),
      ],
      materials: [
        mat({ id: 'm-1', sku: 'AGG-1.5', category: 'AGGREGATE' }),
        mat({ id: 'm-2', sku: 'REBAR-4', category: 'REBAR' }),
        mat({ id: 'm-3', sku: 'DIESEL', category: 'FUEL' }),
      ],
    });
    expect(r.rows[0]?.totalSpendCents).toBe(4_500_00);
    expect(r.rows[0]?.topCategory).toBe('AGGREGATE');
    expect(r.rows[0]?.byCategory).toHaveLength(3);
  });

  it('uses per-line jobId override when set', () => {
    const r = buildJobMaterialSpend({
      apInvoices: [
        ap({
          id: 'ap-1',
          jobId: 'job-default',
          lineItems: [
            { description: 'a', quantity: 1, unitPriceCents: 0, lineTotalCents: 1_000_00, jobId: 'job-A', costCode: 'AGG-1.5' },
            { description: 'b', quantity: 1, unitPriceCents: 0, lineTotalCents: 500_00, costCode: 'AGG-1.5' },
          ],
        }),
      ],
      materials: [mat({})],
    });
    expect(r.rows).toHaveLength(2);
    const a = r.rows.find(r => r.jobId === 'job-A');
    const def = r.rows.find(r => r.jobId === 'job-default');
    expect(a?.totalSpendCents).toBe(1_000_00);
    expect(def?.totalSpendCents).toBe(500_00);
  });

  it('skips line items with no jobId at all (header or line)', () => {
    const r = buildJobMaterialSpend({
      apInvoices: [
        ap({
          id: 'ap-1',
          jobId: undefined,
          lineItems: [
            { description: 'orphan', quantity: 1, unitPriceCents: 0, lineTotalCents: 1_000_00 },
          ],
        }),
      ],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('respects fromDate / toDate range filter', () => {
    const r = buildJobMaterialSpend({
      fromDate: '2026-04-15',
      toDate: '2026-04-30',
      apInvoices: [
        ap({ id: 'ap-1', invoiceDate: '2026-04-01' }),
        ap({ id: 'ap-2', invoiceDate: '2026-04-20' }),
      ],
    });
    expect(r.rows[0]?.totalSpendCents).toBe(2_500_00);
  });

  it('rolls up grand totals by category across all jobs', () => {
    const r = buildJobMaterialSpend({
      apInvoices: [
        ap({
          id: 'ap-1',
          jobId: 'job-1',
          lineItems: [
            { description: 'a', quantity: 1, unitPriceCents: 0, lineTotalCents: 3_000_00, costCode: 'AGG-1.5' },
          ],
        }),
        ap({
          id: 'ap-2',
          jobId: 'job-2',
          lineItems: [
            { description: 'b', quantity: 1, unitPriceCents: 0, lineTotalCents: 2_000_00, costCode: 'AGG-1.5' },
          ],
        }),
      ],
      materials: [mat({ sku: 'AGG-1.5', category: 'AGGREGATE' })],
    });
    expect(r.rollup.totalSpendCents).toBe(5_000_00);
    expect(r.rollup.byCategory[0]?.category).toBe('AGGREGATE');
    expect(r.rollup.byCategory[0]?.spendCents).toBe(5_000_00);
  });

  it('sorts rows by job total spend desc', () => {
    const r = buildJobMaterialSpend({
      apInvoices: [
        ap({ id: 'ap-1', jobId: 'job-small', totalCents: 100_00, lineItems: [
          { description: 'x', quantity: 1, unitPriceCents: 0, lineTotalCents: 100_00 },
        ]}),
        ap({ id: 'ap-2', jobId: 'job-big', totalCents: 9_000_00, lineItems: [
          { description: 'y', quantity: 1, unitPriceCents: 0, lineTotalCents: 9_000_00 },
        ]}),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('job-big');
    expect(r.rows[1]?.jobId).toBe('job-small');
  });
});
