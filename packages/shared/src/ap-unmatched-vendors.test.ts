import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Vendor } from './vendor';

import { buildApUnmatchedVendors } from './ap-unmatched-vendors';

function vendor(over: Partial<Vendor>): Vendor {
  return {
    id: 'vnd-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    legalName: 'Acme Supply LLC',
    kind: 'SUPPLIER',
    w9OnFile: false,
    is1099Reportable: false,
    coiOnFile: false,
    paymentTerms: 'NET_30',
    onHold: false,
    ...over,
  } as Vendor;
}

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    vendorName: 'Acme Supply LLC',
    invoiceDate: '2026-04-01',
    lineItems: [],
    totalCents: 100_00,
    paidCents: 100_00,
    status: 'PAID',
    ...over,
  } as ApInvoice;
}

describe('buildApUnmatchedVendors', () => {
  it('drops invoices that match a vendor master legalName', () => {
    const r = buildApUnmatchedVendors({
      vendors: [vendor({ legalName: 'Acme Supply LLC' })],
      apInvoices: [ap({ vendorName: 'Acme Supply LLC' })],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('drops invoices that match a vendor dbaName', () => {
    const r = buildApUnmatchedVendors({
      vendors: [vendor({ legalName: 'Big Company LLC', dbaName: 'BigCo' })],
      apInvoices: [ap({ vendorName: 'BigCo' })],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('matches case-insensitively (suffix-stripped)', () => {
    const r = buildApUnmatchedVendors({
      vendors: [vendor({ legalName: 'Acme Supply LLC' })],
      apInvoices: [
        ap({ vendorName: 'ACME SUPPLY' }),
        ap({ vendorName: 'acme supply, inc.' }),
      ],
    });
    // Both normalize to 'acme supply' which matches vendor 'acme supply'
    expect(r.rows).toHaveLength(0);
  });

  it('flags invoices whose vendorName has no master record', () => {
    const r = buildApUnmatchedVendors({
      vendors: [],
      apInvoices: [
        ap({ id: 'ap-1', vendorName: 'Mystery Vendor' }),
        ap({ id: 'ap-2', vendorName: 'Mystery Vendor', totalCents: 50_00, paidCents: 50_00 }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.invoiceCount).toBe(2);
    expect(r.rows[0]?.totalCents).toBe(150_00);
  });

  it('skips DRAFT and REJECTED invoices', () => {
    const r = buildApUnmatchedVendors({
      vendors: [],
      apInvoices: [
        ap({ id: 'ap-1', vendorName: 'X', status: 'DRAFT' }),
        ap({ id: 'ap-2', vendorName: 'X', status: 'REJECTED' }),
      ],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('respects fromDate / toDate range', () => {
    const r = buildApUnmatchedVendors({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      vendors: [],
      apInvoices: [
        ap({ id: 'ap-old', vendorName: 'X', invoiceDate: '2026-03-01' }),
        ap({ id: 'ap-in', vendorName: 'X', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.invoiceCount).toBe(1);
    expect(r.rows[0]?.sampleInvoiceIds).toEqual(['ap-in']);
  });

  it('captures earliest + latest invoice dates per group', () => {
    const r = buildApUnmatchedVendors({
      vendors: [],
      apInvoices: [
        ap({ id: 'ap-1', vendorName: 'X', invoiceDate: '2026-01-15' }),
        ap({ id: 'ap-2', vendorName: 'X', invoiceDate: '2026-04-20' }),
        ap({ id: 'ap-3', vendorName: 'X', invoiceDate: '2026-02-10' }),
      ],
    });
    expect(r.rows[0]?.earliestInvoiceDate).toBe('2026-01-15');
    expect(r.rows[0]?.latestInvoiceDate).toBe('2026-04-20');
  });

  it('caps sampleInvoiceIds at 5', () => {
    const apInvoices: ApInvoice[] = [];
    for (let i = 0; i < 8; i++) {
      apInvoices.push(ap({ id: `ap-${i}`, vendorName: 'X' }));
    }
    const r = buildApUnmatchedVendors({
      vendors: [],
      apInvoices,
    });
    expect(r.rows[0]?.sampleInvoiceIds).toHaveLength(5);
    expect(r.rows[0]?.invoiceCount).toBe(8);
  });

  it('rolls up totals across all unmatched groups', () => {
    const r = buildApUnmatchedVendors({
      vendors: [],
      apInvoices: [
        ap({ id: 'ap-1', vendorName: 'X', totalCents: 100_00, paidCents: 50_00 }),
        ap({ id: 'ap-2', vendorName: 'Y', totalCents: 200_00, paidCents: 200_00 }),
      ],
    });
    expect(r.rollup.unmatchedNameCount).toBe(2);
    expect(r.rollup.unmatchedInvoiceCount).toBe(2);
    expect(r.rollup.unmatchedTotalCents).toBe(300_00);
    expect(r.rollup.unmatchedPaidCents).toBe(250_00);
  });

  it('sorts rows by total cents desc', () => {
    const r = buildApUnmatchedVendors({
      vendors: [],
      apInvoices: [
        ap({ id: 'ap-small', vendorName: 'Small', totalCents: 100_00 }),
        ap({ id: 'ap-big', vendorName: 'Big', totalCents: 5_000_00 }),
      ],
    });
    expect(r.rows[0]?.vendorNameAsTyped).toBe('Big');
    expect(r.rows[1]?.vendorNameAsTyped).toBe('Small');
  });
});
