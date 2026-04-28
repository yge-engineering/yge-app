import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';

import { buildCustomerPaymentLag } from './customer-payment-lag';

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'j1',
    invoiceNumber: '1',
    customerName: 'CAL FIRE',
    source: 'PROGRESS',
    lineItems: [],
    paidCents: 0,
    status: 'SENT',
    ...over,
  } as ArInvoice;
}

function pay(over: Partial<ArPayment>): ArPayment {
  return {
    id: 'arp-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    arInvoiceId: 'ar-1',
    jobId: 'j1',
    kind: 'PROGRESS',
    method: 'CHECK',
    receivedOn: '2026-04-15',
    amountCents: 100_000_00,
    ...over,
  } as ArPayment;
}

describe('buildCustomerPaymentLag', () => {
  it('groups by canonicalized customer name', () => {
    const r = buildCustomerPaymentLag({
      arInvoices: [
        ar({ id: 'a', customerName: 'CAL FIRE' }),
        ar({ id: 'b', customerName: 'Cal Fire' }),
      ],
      arPayments: [
        pay({ id: 'p1', arInvoiceId: 'a', receivedOn: '2026-04-15' }),
        pay({ id: 'p2', arInvoiceId: 'b', receivedOn: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.invoicesPaired).toBe(2);
  });

  it('uses earliest payment date as first-cash', () => {
    const r = buildCustomerPaymentLag({
      arInvoices: [ar({ id: 'a', createdAt: '2026-04-01T00:00:00.000Z' })],
      arPayments: [
        pay({ id: 'late', arInvoiceId: 'a', receivedOn: '2026-04-30' }),
        pay({ id: 'early', arInvoiceId: 'a', receivedOn: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.medianDays).toBe(14);
  });

  it('counts unpaid invoices separately', () => {
    const r = buildCustomerPaymentLag({
      arInvoices: [
        ar({ id: 'a' }),
        ar({ id: 'b' }),
      ],
      arPayments: [pay({ id: 'p', arInvoiceId: 'a' })],
    });
    expect(r.rows[0]?.invoicesPaired).toBe(1);
    expect(r.rows[0]?.invoicesUnpaid).toBe(1);
  });

  it('computes percentiles (R-style linear interpolation)', () => {
    // Days 5, 10, 15, 20, 25 (sorted)
    const r = buildCustomerPaymentLag({
      arInvoices: [
        ar({ id: 'a', createdAt: '2026-01-01T00:00:00.000Z' }),
        ar({ id: 'b', createdAt: '2026-01-01T00:00:00.000Z' }),
        ar({ id: 'c', createdAt: '2026-01-01T00:00:00.000Z' }),
        ar({ id: 'd', createdAt: '2026-01-01T00:00:00.000Z' }),
        ar({ id: 'e', createdAt: '2026-01-01T00:00:00.000Z' }),
      ],
      arPayments: [
        pay({ id: 'p1', arInvoiceId: 'a', receivedOn: '2026-01-06' }),
        pay({ id: 'p2', arInvoiceId: 'b', receivedOn: '2026-01-11' }),
        pay({ id: 'p3', arInvoiceId: 'c', receivedOn: '2026-01-16' }),
        pay({ id: 'p4', arInvoiceId: 'd', receivedOn: '2026-01-21' }),
        pay({ id: 'p5', arInvoiceId: 'e', receivedOn: '2026-01-26' }),
      ],
    });
    const row = r.rows[0];
    expect(row?.medianDays).toBe(15);
    expect(row?.p25Days).toBe(10);
    expect(row?.p75Days).toBe(20);
    expect(row?.maxDays).toBe(25);
  });

  it('skips DRAFT invoices', () => {
    const r = buildCustomerPaymentLag({
      arInvoices: [
        ar({ id: 'd', status: 'DRAFT' }),
        ar({ id: 'a', status: 'SENT' }),
      ],
      arPayments: [pay({ arInvoiceId: 'a' })],
    });
    expect(r.rollup.totalInvoicesPaired).toBe(1);
  });

  it('respects fromDate/toDate window on createdAt', () => {
    const r = buildCustomerPaymentLag({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arInvoices: [
        ar({ id: 'old', createdAt: '2026-03-15T00:00:00.000Z' }),
        ar({ id: 'in', createdAt: '2026-04-15T00:00:00.000Z' }),
        ar({ id: 'after', createdAt: '2026-05-15T00:00:00.000Z' }),
      ],
      arPayments: [
        pay({ id: 'p1', arInvoiceId: 'old' }),
        pay({ id: 'p2', arInvoiceId: 'in' }),
        pay({ id: 'p3', arInvoiceId: 'after' }),
      ],
    });
    expect(r.rollup.totalInvoicesPaired + r.rollup.totalInvoicesUnpaid).toBe(1);
  });

  it('sorts slowest-paying customers first', () => {
    const r = buildCustomerPaymentLag({
      arInvoices: [
        ar({ id: 'fast', customerName: 'Fast Pay', createdAt: '2026-04-01T00:00:00.000Z' }),
        ar({ id: 'slow', customerName: 'Slow Pay', createdAt: '2026-04-01T00:00:00.000Z' }),
      ],
      arPayments: [
        pay({ id: 'pf', arInvoiceId: 'fast', receivedOn: '2026-04-05' }),
        pay({ id: 'ps', arInvoiceId: 'slow', receivedOn: '2026-05-30' }),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('Slow Pay');
  });

  it('null percentiles when no paired invoices', () => {
    const r = buildCustomerPaymentLag({
      arInvoices: [ar({})],
      arPayments: [],
    });
    expect(r.rows[0]?.medianDays).toBe(null);
    expect(r.rows[0]?.invoicesUnpaid).toBe(1);
  });

  it('rolls up blended median across portfolio', () => {
    const r = buildCustomerPaymentLag({
      arInvoices: [
        ar({ id: 'a', customerName: 'A', createdAt: '2026-04-01T00:00:00.000Z' }),
        ar({ id: 'b', customerName: 'B', createdAt: '2026-04-01T00:00:00.000Z' }),
        ar({ id: 'c', customerName: 'C', createdAt: '2026-04-01T00:00:00.000Z' }),
      ],
      arPayments: [
        pay({ id: 'pa', arInvoiceId: 'a', receivedOn: '2026-04-11' }),
        pay({ id: 'pb', arInvoiceId: 'b', receivedOn: '2026-04-21' }),
        pay({ id: 'pc', arInvoiceId: 'c', receivedOn: '2026-05-01' }),
      ],
    });
    expect(r.rollup.blendedMedianDays).toBe(20);
  });

  it('handles empty input', () => {
    const r = buildCustomerPaymentLag({ arInvoices: [], arPayments: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.blendedMedianDays).toBe(null);
  });
});
