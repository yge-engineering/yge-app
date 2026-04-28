import { describe, expect, it } from 'vitest';

import type { ApInvoice, ApInvoiceLineItem } from './ap-invoice';

import { buildVendorLineCount } from './vendor-line-count';

const li = (n: number): ApInvoiceLineItem[] =>
  Array.from({ length: n }).map((_, i) => ({
    description: `Line ${i + 1}`,
    quantity: 1,
    unitPriceCents: 100,
    lineTotalCents: 100,
  } as ApInvoiceLineItem));

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    vendorName: 'Acme',
    invoiceDate: '2026-04-15',
    lineItems: li(1),
    totalCents: 100,
    paidCents: 0,
    status: 'APPROVED',
    ...over,
  } as ApInvoice;
}

describe('buildVendorLineCount', () => {
  it('groups by canonicalized vendor name', () => {
    const r = buildVendorLineCount({
      apInvoices: [
        ap({ id: 'a', vendorName: 'Acme' }),
        ap({ id: 'b', vendorName: 'ACME, INC.' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('computes avg / min / max line count', () => {
    const r = buildVendorLineCount({
      apInvoices: [
        ap({ id: 'a', lineItems: li(2) }),
        ap({ id: 'b', lineItems: li(5) }),
        ap({ id: 'c', lineItems: li(8) }),
      ],
    });
    const row = r.rows[0];
    expect(row?.avgLines).toBe(5);
    expect(row?.minLines).toBe(2);
    expect(row?.maxLines).toBe(8);
    expect(row?.totalLines).toBe(15);
  });

  it('counts lump-sum (single-line) invoices', () => {
    const r = buildVendorLineCount({
      apInvoices: [
        ap({ id: 'a', lineItems: li(1) }),
        ap({ id: 'b', lineItems: li(1) }),
        ap({ id: 'c', lineItems: li(5) }),
      ],
    });
    expect(r.rows[0]?.lumpSumCount).toBe(2);
    expect(r.rows[0]?.lumpSumShare).toBeCloseTo(2 / 3, 4);
  });

  it('skips DRAFT + REJECTED', () => {
    const r = buildVendorLineCount({
      apInvoices: [
        ap({ id: 'd', status: 'DRAFT' }),
        ap({ id: 'r', status: 'REJECTED' }),
        ap({ id: 'a', status: 'APPROVED' }),
      ],
    });
    expect(r.rollup.invoicesConsidered).toBe(1);
  });

  it('respects window bounds', () => {
    const r = buildVendorLineCount({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      apInvoices: [
        ap({ id: 'old', invoiceDate: '2026-03-15' }),
        ap({ id: 'in', invoiceDate: '2026-04-15' }),
        ap({ id: 'after', invoiceDate: '2026-05-15' }),
      ],
    });
    expect(r.rollup.invoicesConsidered).toBe(1);
  });

  it('sorts highest lump-sum share first', () => {
    const r = buildVendorLineCount({
      apInvoices: [
        ap({ id: 'd1', vendorName: 'Detailed Vendor', lineItems: li(10) }),
        ap({ id: 'd2', vendorName: 'Detailed Vendor', lineItems: li(8) }),
        ap({ id: 'l1', vendorName: 'Lumpy Vendor', lineItems: li(1) }),
        ap({ id: 'l2', vendorName: 'Lumpy Vendor', lineItems: li(1) }),
      ],
    });
    expect(r.rows[0]?.vendorName).toBe('Lumpy Vendor');
  });

  it('handles empty input', () => {
    const r = buildVendorLineCount({ apInvoices: [] });
    expect(r.rows).toHaveLength(0);
  });
});
