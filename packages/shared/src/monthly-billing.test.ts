import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';

import { buildMonthlyBilling } from './monthly-billing';

function ar(over: Partial<ArInvoice>): ArInvoice {
  const lineItems = over.lineItems ?? [
    {
      kind: 'OTHER' as const,
      description: 'Progress billing',
      quantity: 1,
      unitPriceCents: 100_000_00,
      lineTotalCents: 100_000_00,
    },
  ];
  return {
    id: 'ar-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    jobId: 'j1',
    invoiceNumber: '1',
    customerName: 'CAL FIRE',
    source: 'PROGRESS',
    lineItems,
    paidCents: 0,
    status: 'SENT',
    ...over,
  } as ArInvoice;
}

describe('buildMonthlyBilling', () => {
  it('buckets invoices by yyyy-mm', () => {
    const r = buildMonthlyBilling({
      arInvoices: [
        ar({ id: 'a', createdAt: '2026-03-15T00:00:00.000Z' }),
        ar({ id: 'b', createdAt: '2026-03-25T00:00:00.000Z' }),
        ar({ id: 'c', createdAt: '2026-04-10T00:00:00.000Z' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]?.month).toBe('2026-03');
    expect(r.rows[0]?.invoiceCount).toBe(2);
    expect(r.rows[1]?.month).toBe('2026-04');
    expect(r.rows[1]?.invoiceCount).toBe(1);
  });

  it('sums lineTotalCents into totalBilledCents', () => {
    const r = buildMonthlyBilling({
      arInvoices: [
        ar({
          id: 'a',
          lineItems: [
            { kind: 'LABOR' as const, description: 'Crew', quantity: 1, unitPriceCents: 5_000_00, lineTotalCents: 5_000_00 },
            { kind: 'EQUIPMENT' as const, description: 'CAT 320', quantity: 1, unitPriceCents: 3_000_00, lineTotalCents: 3_000_00 },
          ],
        }),
      ],
    });
    expect(r.rows[0]?.totalBilledCents).toBe(8_000_00);
  });

  it('skips DRAFT invoices', () => {
    const r = buildMonthlyBilling({
      arInvoices: [
        ar({ id: 'a', status: 'DRAFT' }),
        ar({ id: 'b', status: 'SENT' }),
      ],
    });
    expect(r.rollup.totalInvoices).toBe(1);
  });

  it('computes outstanding = billed - paid', () => {
    const r = buildMonthlyBilling({
      arInvoices: [
        ar({
          id: 'a',
          paidCents: 30_000_00,
          lineItems: [
            { kind: 'OTHER' as const, description: 'Progress', quantity: 1, unitPriceCents: 100_000_00, lineTotalCents: 100_000_00 },
          ],
        }),
      ],
    });
    expect(r.rows[0]?.totalPaidCents).toBe(30_000_00);
    expect(r.rows[0]?.outstandingCents).toBe(70_000_00);
  });

  it('counts distinct customers + jobs (case-insensitive)', () => {
    const r = buildMonthlyBilling({
      arInvoices: [
        ar({ id: 'a', customerName: 'CAL FIRE', jobId: 'j1' }),
        ar({ id: 'b', customerName: 'Cal Fire', jobId: 'j2' }),
        ar({ id: 'c', customerName: 'Caltrans', jobId: 'j1' }),
      ],
    });
    expect(r.rows[0]?.distinctCustomers).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('respects fromMonth/toMonth bounds', () => {
    const r = buildMonthlyBilling({
      fromMonth: '2026-03',
      toMonth: '2026-04',
      arInvoices: [
        ar({ id: 'jan', createdAt: '2026-01-15T00:00:00.000Z' }),
        ar({ id: 'mar', createdAt: '2026-03-15T00:00:00.000Z' }),
        ar({ id: 'apr', createdAt: '2026-04-15T00:00:00.000Z' }),
        ar({ id: 'may', createdAt: '2026-05-15T00:00:00.000Z' }),
      ],
    });
    expect(r.rollup.totalInvoices).toBe(2);
  });

  it('captures peak month', () => {
    const r = buildMonthlyBilling({
      arInvoices: [
        ar({
          id: 'a',
          createdAt: '2026-03-15T00:00:00.000Z',
          lineItems: [{ kind: 'OTHER' as const, description: 'p', quantity: 1, unitPriceCents: 50_000_00, lineTotalCents: 50_000_00 }],
        }),
        ar({
          id: 'b',
          createdAt: '2026-04-15T00:00:00.000Z',
          lineItems: [{ kind: 'OTHER' as const, description: 'p', quantity: 1, unitPriceCents: 200_000_00, lineTotalCents: 200_000_00 }],
        }),
      ],
    });
    expect(r.rollup.peakMonth).toBe('2026-04');
    expect(r.rollup.peakBilledCents).toBe(200_000_00);
  });

  it('computes month-over-month delta', () => {
    const r = buildMonthlyBilling({
      arInvoices: [
        ar({
          id: 'a',
          createdAt: '2026-03-15T00:00:00.000Z',
          lineItems: [{ kind: 'OTHER' as const, description: 'p', quantity: 1, unitPriceCents: 100_000_00, lineTotalCents: 100_000_00 }],
        }),
        ar({
          id: 'b',
          createdAt: '2026-04-15T00:00:00.000Z',
          lineItems: [{ kind: 'OTHER' as const, description: 'p', quantity: 1, unitPriceCents: 130_000_00, lineTotalCents: 130_000_00 }],
        }),
      ],
    });
    expect(r.rollup.monthOverMonthChangeCents).toBe(30_000_00);
  });

  it('handles empty input', () => {
    const r = buildMonthlyBilling({ arInvoices: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.peakMonth).toBe(null);
    expect(r.rollup.monthOverMonthChangeCents).toBe(0);
  });
});
