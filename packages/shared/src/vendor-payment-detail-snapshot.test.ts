import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { ApPayment } from './ap-payment';

import { buildVendorPaymentDetailSnapshot } from './vendor-payment-detail-snapshot';

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '',
    updatedAt: '',
    vendorName: 'Granite',
    invoiceDate: '2026-04-15',
    jobId: 'j1',
    lineItems: [],
    totalCents: 100_000_00,
    paidCents: 0,
    status: 'PENDING',
    ...over,
  } as ApInvoice;
}

function pay(over: Partial<ApPayment>): ApPayment {
  return {
    id: 'app-1',
    createdAt: '',
    updatedAt: '',
    apInvoiceId: 'ap-1',
    vendorName: 'Granite',
    method: 'CHECK',
    paidOn: '2026-04-20',
    amountCents: 50_000_00,
    cleared: false,
    voided: false,
    ...over,
  } as ApPayment;
}

describe('buildVendorPaymentDetailSnapshot', () => {
  it('returns one row per job sorted by total paid', () => {
    const r = buildVendorPaymentDetailSnapshot({
      vendorName: 'Granite',
      asOf: '2026-04-30',
      apInvoices: [
        ap({ id: 'inv-a', jobId: 'j1' }),
        ap({ id: 'inv-b', jobId: 'j1' }),
        ap({ id: 'inv-c', jobId: 'j2' }),
      ],
      apPayments: [
        pay({ id: 'p1', apInvoiceId: 'inv-a', vendorName: 'Granite', method: 'CHECK', amountCents: 100_000_00, cleared: true }),
        pay({ id: 'p2', apInvoiceId: 'inv-b', vendorName: 'GRANITE LLC', method: 'ACH', amountCents: 25_000_00 }),
        pay({ id: 'p3', apInvoiceId: 'inv-b', vendorName: 'Granite Inc.', method: 'WIRE', amountCents: 5_000_00, voided: true }),
        pay({ id: 'p4', apInvoiceId: 'inv-c', vendorName: 'Granite', method: 'CHECK', amountCents: 60_000_00 }),
        pay({ id: 'pX', apInvoiceId: 'inv-a', vendorName: 'Other', amountCents: 999 }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('j1');
    expect(r.rows[0]?.paymentCount).toBe(3);
    expect(r.rows[0]?.totalCents).toBe(125_000_00);
    expect(r.rows[0]?.voidedCount).toBe(1);
    expect(r.rows[0]?.voidedCents).toBe(5_000_00);
    expect(r.rows[0]?.clearedCount).toBe(1);
    expect(r.rows[0]?.checkCount).toBe(1);
    expect(r.rows[0]?.achCount).toBe(1);
    expect(r.rows[0]?.wireCount).toBe(1);
    expect(r.rows[1]?.jobId).toBe('j2');
    expect(r.rows[1]?.totalCents).toBe(60_000_00);
  });

  it('handles unknown vendor', () => {
    const r = buildVendorPaymentDetailSnapshot({
      vendorName: 'X',
      apInvoices: [],
      apPayments: [],
    });
    expect(r.rows.length).toBe(0);
  });
});
