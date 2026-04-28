import { describe, expect, it } from 'vitest';

import type { ApInvoice, ApInvoiceLineItem } from './ap-invoice';

import { buildVendorInvoiceShape } from './vendor-invoice-shape';

function line(over: Partial<ApInvoiceLineItem>): ApInvoiceLineItem {
  return {
    description: 'X',
    quantity: 1,
    unitPriceCents: 100_00,
    lineTotalCents: 100_00,
    ...over,
  } as ApInvoiceLineItem;
}

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    vendorName: 'Acme Supply',
    invoiceDate: '2026-04-15',
    lineItems: [],
    totalCents: 100_00,
    paidCents: 0,
    status: 'APPROVED',
    ...over,
  } as ApInvoice;
}

describe('buildVendorInvoiceShape', () => {
  it('skips DRAFT and REJECTED invoices', () => {
    const r = buildVendorInvoiceShape({
      apInvoices: [
        ap({ id: 'd', status: 'DRAFT' }),
        ap({ id: 'r', status: 'REJECTED' }),
      ],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('respects window bounds', () => {
    const r = buildVendorInvoiceShape({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      apInvoices: [
        ap({ id: 'old', invoiceDate: '2026-03-15' }),
        ap({ id: 'in', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.invoiceCount).toBe(1);
  });

  it('case-insensitively merges vendor names', () => {
    const r = buildVendorInvoiceShape({
      apInvoices: [
        ap({ id: 'a', vendorName: 'Acme Supply' }),
        ap({ id: 'b', vendorName: 'ACME SUPPLY' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('computes avg invoice + median line', () => {
    const r = buildVendorInvoiceShape({
      apInvoices: [
        ap({
          id: 'a',
          totalCents: 1_000_00,
          lineItems: [line({ lineTotalCents: 600_00 }), line({ lineTotalCents: 400_00 })],
        }),
        ap({
          id: 'b',
          totalCents: 2_000_00,
          lineItems: [line({ lineTotalCents: 800_00 }), line({ lineTotalCents: 1_200_00 })],
        }),
      ],
    });
    expect(r.rows[0]?.avgInvoiceCents).toBe(1_500_00);
    // Lines sorted: 400, 600, 800, 1200. Median = (600+800)/2 = 700.
    expect(r.rows[0]?.medianLineCents).toBe(700_00);
  });

  it('computes avg lines per invoice', () => {
    const r = buildVendorInvoiceShape({
      apInvoices: [
        ap({
          id: 'a',
          lineItems: [line({}), line({}), line({})],
        }),
        ap({
          id: 'b',
          lineItems: [line({})],
        }),
      ],
    });
    expect(r.rows[0]?.avgLinesPerInvoice).toBe(2);
  });

  it('rolls up top cost codes', () => {
    const r = buildVendorInvoiceShape({
      apInvoices: [
        ap({
          lineItems: [
            line({ costCode: '03-30-00' }),
            line({ costCode: '03-30-00' }),
            line({ costCode: '03-30-00' }),
            line({ costCode: '03-31-00' }),
          ],
        }),
      ],
    });
    expect(r.rows[0]?.topCostCodes[0]?.code).toBe('03-30-00');
    expect(r.rows[0]?.topCostCodes[0]?.count).toBe(3);
  });

  it('respects topN setting', () => {
    const r = buildVendorInvoiceShape({
      topN: 2,
      apInvoices: [
        ap({
          lineItems: [
            line({ costCode: 'A' }),
            line({ costCode: 'B' }),
            line({ costCode: 'C' }),
            line({ costCode: 'D' }),
          ],
        }),
      ],
    });
    expect(r.rows[0]?.topCostCodes).toHaveLength(2);
  });

  it('respects minInvoices filter', () => {
    const r = buildVendorInvoiceShape({
      minInvoices: 2,
      apInvoices: [
        ap({ id: 'a', vendorName: 'Once Vendor' }),
        ap({ id: 'b', vendorName: 'Repeat Vendor' }),
        ap({ id: 'c', vendorName: 'Repeat Vendor' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.vendorName).toBe('Repeat Vendor');
  });

  it('rolls up totals + sorts highest spend first', () => {
    const r = buildVendorInvoiceShape({
      apInvoices: [
        ap({ id: 'a', vendorName: 'Big', totalCents: 1_000_00 }),
        ap({ id: 'b', vendorName: 'Bigger', totalCents: 5_000_00 }),
      ],
    });
    expect(r.rows[0]?.vendorName).toBe('Bigger');
    expect(r.rollup.totalCents).toBe(6_000_00);
  });
});
