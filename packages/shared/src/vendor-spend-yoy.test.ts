import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';

import { buildVendorSpendYoy } from './vendor-spend-yoy';

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    vendorName: 'Granite',
    invoiceDate: '2026-04-15',
    lineItems: [],
    totalCents: 50_000_00,
    paidCents: 0,
    status: 'PENDING',
    ...over,
  } as ApInvoice;
}

describe('buildVendorSpendYoy', () => {
  it('groups by (vendor, year)', () => {
    const r = buildVendorSpendYoy({
      apInvoices: [
        ap({ id: 'a', invoiceDate: '2025-04-15' }),
        ap({ id: 'b', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('computes YoY change', () => {
    const r = buildVendorSpendYoy({
      apInvoices: [
        ap({ id: 'a', invoiceDate: '2025-04-15', totalCents: 50_000_00 }),
        ap({ id: 'b', invoiceDate: '2026-04-15', totalCents: 100_000_00 }),
      ],
    });
    const cur = r.rows.find((x) => x.year === 2026);
    expect(cur?.yoyChangeCents).toBe(50_000_00);
    expect(cur?.yoyChangePct).toBe(1);
  });

  it('canonicalizes vendor name', () => {
    const r = buildVendorSpendYoy({
      apInvoices: [
        ap({ id: 'a', vendorName: 'Granite Construction Inc.' }),
        ap({ id: 'b', vendorName: 'GRANITE CONSTRUCTION' }),
      ],
    });
    expect(r.rollup.vendorsConsidered).toBe(1);
  });

  it('respects fromYear / toYear', () => {
    const r = buildVendorSpendYoy({
      fromYear: 2026,
      toYear: 2026,
      apInvoices: [
        ap({ id: 'old', invoiceDate: '2025-04-15' }),
        ap({ id: 'in', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sorts by vendor asc, year asc', () => {
    const r = buildVendorSpendYoy({
      apInvoices: [
        ap({ id: 'a', vendorName: 'Z', invoiceDate: '2026-04-15' }),
        ap({ id: 'b', vendorName: 'A', invoiceDate: '2025-04-15' }),
      ],
    });
    expect(r.rows[0]?.vendorName).toBe('A');
  });

  it('handles empty input', () => {
    const r = buildVendorSpendYoy({ apInvoices: [] });
    expect(r.rows).toHaveLength(0);
  });
});
