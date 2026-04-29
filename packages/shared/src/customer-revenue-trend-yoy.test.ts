import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';

import { buildCustomerRevenueTrendYoy } from './customer-revenue-trend-yoy';

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'j1',
    invoiceNumber: '1',
    customerName: 'CAL FIRE',
    invoiceDate: '2026-04-15',
    source: 'PROGRESS',
    lineItems: [],
    totalCents: 100_000_00,
    paidCents: 0,
    status: 'SENT',
    ...over,
  } as ArInvoice;
}

describe('buildCustomerRevenueTrendYoy', () => {
  it('groups by (customer, year)', () => {
    const r = buildCustomerRevenueTrendYoy({
      arInvoices: [
        ar({ id: 'a', invoiceDate: '2025-04-15', totalCents: 50_000_00 }),
        ar({ id: 'b', invoiceDate: '2026-04-15', totalCents: 80_000_00 }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('computes YoY change cents and pct', () => {
    const r = buildCustomerRevenueTrendYoy({
      arInvoices: [
        ar({ id: 'a', invoiceDate: '2025-04-15', totalCents: 50_000_00 }),
        ar({ id: 'b', invoiceDate: '2026-04-15', totalCents: 100_000_00 }),
      ],
    });
    const cur = r.rows.find((x) => x.year === 2026);
    expect(cur?.yoyChangeCents).toBe(50_000_00);
    expect(cur?.yoyChangePct).toBe(1);
  });

  it('returns YoY 0 when no prior-year data', () => {
    const r = buildCustomerRevenueTrendYoy({
      arInvoices: [ar({ invoiceDate: '2026-04-15' })],
    });
    expect(r.rows[0]?.yoyChangePct).toBe(0);
  });

  it('canonicalizes customer name', () => {
    const r = buildCustomerRevenueTrendYoy({
      arInvoices: [
        ar({ id: 'a', customerName: 'CAL FIRE' }),
        ar({ id: 'b', customerName: 'Cal Fire, Inc.' }),
      ],
    });
    expect(r.rollup.customersConsidered).toBe(1);
  });

  it('respects fromYear / toYear bounds', () => {
    const r = buildCustomerRevenueTrendYoy({
      fromYear: 2026,
      toYear: 2026,
      arInvoices: [
        ar({ id: 'old', invoiceDate: '2025-04-15' }),
        ar({ id: 'in', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sorts by customer asc, year asc', () => {
    const r = buildCustomerRevenueTrendYoy({
      arInvoices: [
        ar({ id: 'a', customerName: 'Z', invoiceDate: '2026-04-15' }),
        ar({ id: 'b', customerName: 'A', invoiceDate: '2026-04-15' }),
        ar({ id: 'c', customerName: 'A', invoiceDate: '2025-04-15' }),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('A');
    expect(r.rows[0]?.year).toBe(2025);
  });

  it('handles empty input', () => {
    const r = buildCustomerRevenueTrendYoy({ arInvoices: [] });
    expect(r.rows).toHaveLength(0);
  });
});
