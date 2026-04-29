import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { ApPayment } from './ap-payment';

import { buildVendorPaymentByVendorMonthly } from './vendor-payment-by-vendor-monthly';

function inv(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    vendorName: 'Granite',
    invoiceDate: '2026-04-15',
    jobId: 'j1',
    lineItems: [],
    totalCents: 50_000_00,
    paidCents: 0,
    status: 'PENDING',
    ...over,
  } as ApInvoice;
}

function pay(over: Partial<ApPayment>): ApPayment {
  return {
    id: 'app-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    apInvoiceId: 'ap-1',
    vendorName: 'Granite',
    method: 'CHECK',
    paidOn: '2026-04-15',
    amountCents: 50_000_00,
    cleared: false,
    voided: false,
    ...over,
  } as ApPayment;
}

describe('buildVendorPaymentByVendorMonthly', () => {
  it('groups by (vendor, month)', () => {
    const r = buildVendorPaymentByVendorMonthly({
      apInvoices: [],
      apPayments: [
        pay({ id: 'a', vendorName: 'Granite', paidOn: '2026-04-15' }),
        pay({ id: 'b', vendorName: 'Granite', paidOn: '2026-05-15' }),
        pay({ id: 'c', vendorName: 'Bob Trucking', paidOn: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('canonicalizes vendor name when grouping', () => {
    const r = buildVendorPaymentByVendorMonthly({
      apInvoices: [],
      apPayments: [
        pay({ id: 'a', vendorName: 'Granite' }),
        pay({ id: 'b', vendorName: 'Granite, Inc' }),
        pay({ id: 'c', vendorName: 'GRANITE LLC' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.totalPayments).toBe(3);
  });

  it('skips voided payments', () => {
    const r = buildVendorPaymentByVendorMonthly({
      apInvoices: [],
      apPayments: [
        pay({ id: 'live' }),
        pay({ id: 'gone', voided: true }),
      ],
    });
    expect(r.rollup.totalPayments).toBe(1);
    expect(r.rollup.voidedSkipped).toBe(1);
  });

  it('counts distinct invoices + jobs (via AP invoice join)', () => {
    const r = buildVendorPaymentByVendorMonthly({
      apInvoices: [
        inv({ id: 'i1', jobId: 'j1' }),
        inv({ id: 'i2', jobId: 'j2' }),
      ],
      apPayments: [
        pay({ id: 'a', apInvoiceId: 'i1' }),
        pay({ id: 'b', apInvoiceId: 'i2' }),
        pay({ id: 'c', apInvoiceId: 'i2' }),
      ],
    });
    expect(r.rows[0]?.distinctInvoices).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('tracks first + last paidOn per row', () => {
    const r = buildVendorPaymentByVendorMonthly({
      apInvoices: [],
      apPayments: [
        pay({ id: 'a', paidOn: '2026-04-10' }),
        pay({ id: 'b', paidOn: '2026-04-25' }),
        pay({ id: 'c', paidOn: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.firstPaidOn).toBe('2026-04-10');
    expect(r.rows[0]?.lastPaidOn).toBe('2026-04-25');
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildVendorPaymentByVendorMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      apInvoices: [],
      apPayments: [
        pay({ id: 'old', paidOn: '2026-03-15' }),
        pay({ id: 'in', paidOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalPayments).toBe(1);
  });

  it('sorts by vendorName asc, month asc', () => {
    const r = buildVendorPaymentByVendorMonthly({
      apInvoices: [],
      apPayments: [
        pay({ id: 'a', vendorName: 'Z Corp', paidOn: '2026-04-15' }),
        pay({ id: 'b', vendorName: 'A Corp', paidOn: '2026-05-15' }),
        pay({ id: 'c', vendorName: 'A Corp', paidOn: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.vendorName).toBe('A Corp');
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[2]?.vendorName).toBe('Z Corp');
  });

  it('handles empty input', () => {
    const r = buildVendorPaymentByVendorMonthly({ apInvoices: [], apPayments: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalPayments).toBe(0);
  });
});
