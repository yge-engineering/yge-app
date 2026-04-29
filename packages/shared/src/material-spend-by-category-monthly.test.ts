import { describe, expect, it } from 'vitest';

import type { ApInvoice, ApInvoiceLineItem } from './ap-invoice';
import type { Material } from './material';

import { buildMaterialSpendByCategoryMonthly } from './material-spend-by-category-monthly';

function ln(over: Partial<ApInvoiceLineItem>): ApInvoiceLineItem {
  return {
    description: 'item',
    quantity: 1,
    unitPriceCents: 0,
    lineTotalCents: 0,
    ...over,
  } as ApInvoiceLineItem;
}

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    vendorName: 'Granite',
    invoiceDate: '2026-04-15',
    jobId: 'j1',
    lineItems: [ln({ lineTotalCents: 50_000_00, costCode: 'AGGREGATE' })],
    totalCents: 50_000_00,
    paidCents: 0,
    status: 'PENDING',
    ...over,
  } as ApInvoice;
}

const materials: Material[] = [
  { id: 'm1', createdAt: '', updatedAt: '', name: 'Class 2', category: 'AGGREGATE' } as Material,
  { id: 'm2', createdAt: '', updatedAt: '', name: 'Diesel', category: 'FUEL' } as Material,
];

describe('buildMaterialSpendByCategoryMonthly', () => {
  it('groups by (category, month)', () => {
    const r = buildMaterialSpendByCategoryMonthly({
      materials,
      apInvoices: [
        ap({
          id: 'a',
          invoiceDate: '2026-04-15',
          lineItems: [
            ln({ lineTotalCents: 100_00, costCode: 'AGGREGATE' }),
            ln({ lineTotalCents: 200_00, costCode: 'FUEL' }),
          ],
        }),
        ap({
          id: 'b',
          invoiceDate: '2026-05-01',
          lineItems: [ln({ lineTotalCents: 100_00, costCode: 'AGGREGATE' })],
        }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('sums lineTotalCents per (category, month)', () => {
    const r = buildMaterialSpendByCategoryMonthly({
      materials,
      apInvoices: [
        ap({
          id: 'a',
          lineItems: [
            ln({ lineTotalCents: 30_00, costCode: 'AGGREGATE' }),
            ln({ lineTotalCents: 70_00, costCode: 'AGGREGATE' }),
          ],
        }),
      ],
    });
    expect(r.rows[0]?.totalCents).toBe(100_00);
    expect(r.rows[0]?.lines).toBe(2);
  });

  it('falls to OTHER when costCode is unknown or missing', () => {
    const r = buildMaterialSpendByCategoryMonthly({
      materials,
      apInvoices: [
        ap({
          id: 'a',
          lineItems: [
            ln({ lineTotalCents: 50_00, costCode: 'UNKNOWN_CODE' }),
            ln({ lineTotalCents: 25_00 }),
          ],
        }),
      ],
    });
    const other = r.rows.find((x) => x.category === 'OTHER');
    expect(other?.lines).toBe(2);
    expect(other?.totalCents).toBe(75_00);
  });

  it('counts distinct vendors + jobs', () => {
    const r = buildMaterialSpendByCategoryMonthly({
      materials,
      apInvoices: [
        ap({ id: 'a', vendorName: 'Granite', jobId: 'j1' }),
        ap({ id: 'b', vendorName: 'Bob Trucking', jobId: 'j2' }),
        ap({ id: 'c', vendorName: 'Granite', jobId: 'j1' }),
      ],
    });
    expect(r.rows[0]?.distinctVendors).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildMaterialSpendByCategoryMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      materials,
      apInvoices: [
        ap({ id: 'old', invoiceDate: '2026-03-15' }),
        ap({ id: 'in', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalLines).toBe(1);
  });

  it('sorts by month asc, totalCents desc within month', () => {
    const r = buildMaterialSpendByCategoryMonthly({
      materials,
      apInvoices: [
        ap({
          id: 'a',
          invoiceDate: '2026-04-15',
          lineItems: [
            ln({ lineTotalCents: 50_00, costCode: 'FUEL' }),
            ln({ lineTotalCents: 100_00, costCode: 'AGGREGATE' }),
          ],
        }),
        ap({
          id: 'b',
          invoiceDate: '2026-05-01',
          lineItems: [ln({ lineTotalCents: 200_00, costCode: 'AGGREGATE' })],
        }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[0]?.category).toBe('AGGREGATE');
    expect(r.rows[2]?.month).toBe('2026-05');
  });

  it('handles empty input', () => {
    const r = buildMaterialSpendByCategoryMonthly({ materials: [], apInvoices: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalCents).toBe(0);
  });
});
