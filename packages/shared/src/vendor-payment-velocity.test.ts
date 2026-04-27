import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Vendor } from './vendor';

import { buildVendorPaymentVelocity } from './vendor-payment-velocity';

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
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    vendorName: 'Acme Supply LLC',
    invoiceDate: '2026-01-01',
    lineItems: [],
    totalCents: 100_000,
    paidCents: 100_000,
    status: 'PAID',
    paidAt: '2026-01-25',
    ...over,
  } as ApInvoice;
}

describe('buildVendorPaymentVelocity', () => {
  it('skips invoices that are not PAID', () => {
    const r = buildVendorPaymentVelocity({
      vendors: [vendor({})],
      apInvoices: [
        ap({ id: 'ap-1', status: 'PENDING', paidAt: undefined }),
        ap({ id: 'ap-2', status: 'APPROVED', paidAt: undefined }),
      ],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('computes average days-to-pay from invoice date', () => {
    const r = buildVendorPaymentVelocity({
      vendors: [vendor({ id: 'vnd-1', paymentTerms: 'NET_30' })],
      apInvoices: [
        // 10 days
        ap({ id: 'ap-1', invoiceDate: '2026-01-01', paidAt: '2026-01-11' }),
        // 20 days
        ap({ id: 'ap-2', invoiceDate: '2026-02-01', paidAt: '2026-02-21' }),
      ],
    });
    expect(r.rows[0]?.invoicesPaid).toBe(2);
    expect(r.rows[0]?.avgDaysToPay).toBe(15);
  });

  it('flags EARLY when paid more than 5 days before due date', () => {
    const r = buildVendorPaymentVelocity({
      vendors: [vendor({ paymentTerms: 'NET_30' })],
      apInvoices: [
        ap({ invoiceDate: '2026-01-01', paidAt: '2026-01-11' }), // 19 days early vs day 30
      ],
    });
    expect(r.rows[0]?.earlyCount).toBe(1);
    expect(r.rows[0]?.worstFlag).toBe('EARLY');
  });

  it('flags ON_TIME when paid within 5 days of due date', () => {
    const r = buildVendorPaymentVelocity({
      vendors: [vendor({ paymentTerms: 'NET_30' })],
      apInvoices: [
        ap({ invoiceDate: '2026-01-01', paidAt: '2026-01-31' }), // exactly day 30
      ],
    });
    expect(r.rows[0]?.onTimeCount).toBe(1);
    expect(r.rows[0]?.worstFlag).toBe('ON_TIME');
  });

  it('flags LATE when paid 6-15 days past due', () => {
    const r = buildVendorPaymentVelocity({
      vendors: [vendor({ paymentTerms: 'NET_30' })],
      apInvoices: [
        ap({ invoiceDate: '2026-01-01', paidAt: '2026-02-10' }), // 10 days late
      ],
    });
    expect(r.rows[0]?.lateCount).toBe(1);
    expect(r.rows[0]?.worstFlag).toBe('LATE');
  });

  it('flags VERY_LATE when paid 16+ days past due', () => {
    const r = buildVendorPaymentVelocity({
      vendors: [vendor({ paymentTerms: 'NET_30' })],
      apInvoices: [
        ap({ invoiceDate: '2026-01-01', paidAt: '2026-02-25' }), // 25 days late
      ],
    });
    expect(r.rows[0]?.veryLateCount).toBe(1);
    expect(r.rows[0]?.worstFlag).toBe('VERY_LATE');
  });

  it('uses explicit dueDate when set, ignoring vendor terms', () => {
    const r = buildVendorPaymentVelocity({
      vendors: [vendor({ paymentTerms: 'NET_60' })],
      apInvoices: [
        ap({
          invoiceDate: '2026-01-01',
          dueDate: '2026-01-15',
          paidAt: '2026-01-30',
        }), // 15 days late vs explicit due
      ],
    });
    expect(r.rows[0]?.lateCount).toBe(1);
  });

  it('matches invoice to vendor by DBA name', () => {
    const r = buildVendorPaymentVelocity({
      vendors: [
        vendor({ id: 'vnd-7', legalName: 'Big Company LLC', dbaName: 'BigCo' }),
      ],
      apInvoices: [ap({ vendorName: 'BigCo' })],
    });
    expect(r.rows[0]?.vendorId).toBe('vnd-7');
  });

  it('rolls up vendors-running-late and blended averages', () => {
    const r = buildVendorPaymentVelocity({
      vendors: [
        vendor({ id: 'vnd-a', legalName: 'Alpha LLC', paymentTerms: 'NET_30' }),
        vendor({ id: 'vnd-b', legalName: 'Beta LLC', paymentTerms: 'NET_30' }),
      ],
      apInvoices: [
        // Alpha: 25 days late
        ap({ id: 'ap-a', vendorName: 'Alpha LLC', invoiceDate: '2026-01-01', paidAt: '2026-02-25' }),
        // Beta: on time (day 32)
        ap({ id: 'ap-b', vendorName: 'Beta LLC', invoiceDate: '2026-01-01', paidAt: '2026-02-02' }),
      ],
    });
    expect(r.rollup.vendorsConsidered).toBe(2);
    expect(r.rollup.invoicesConsidered).toBe(2);
    expect(r.rollup.vendorsRunningLate).toBe(1);
    // worst-first sort
    expect(r.rows[0]?.vendorId).toBe('vnd-a');
    expect(r.rows[1]?.vendorId).toBe('vnd-b');
  });
});
