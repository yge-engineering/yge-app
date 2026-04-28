import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';

import { buildCustomerFirstPaymentTiming } from './customer-first-payment-timing';

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    jobId: 'job-1',
    invoiceNumber: '1',
    customerName: 'Cal Fire',
    invoiceDate: '2026-04-01',
    sentAt: '2026-04-01T00:00:00.000Z',
    source: 'PROGRESS',
    lineItems: [],
    subtotalCents: 100_00,
    totalCents: 100_00,
    paidCents: 0,
    status: 'SENT',
    ...over,
  } as ArInvoice;
}

function pay(over: Partial<ArPayment>): ArPayment {
  return {
    id: 'arp-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    arInvoiceId: 'ar-1',
    jobId: 'job-1',
    kind: 'PROGRESS',
    method: 'CHECK',
    receivedOn: '2026-04-15',
    amountCents: 50_000_00,
    ...over,
  } as ArPayment;
}

describe('buildCustomerFirstPaymentTiming', () => {
  it('skips DRAFT and WRITTEN_OFF', () => {
    const r = buildCustomerFirstPaymentTiming({
      arInvoices: [
        ar({ id: 'd', status: 'DRAFT' }),
        ar({ id: 'w', status: 'WRITTEN_OFF' }),
      ],
      arPayments: [],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('skips invoices with no payment yet', () => {
    const r = buildCustomerFirstPaymentTiming({
      arInvoices: [ar({})],
      arPayments: [],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('uses the EARLIEST payment when multiple applied to one invoice', () => {
    const r = buildCustomerFirstPaymentTiming({
      arInvoices: [ar({})],
      arPayments: [
        pay({ id: 'p1', receivedOn: '2026-04-25' }),
        pay({ id: 'p2', receivedOn: '2026-04-15' }),
      ],
    });
    // sentAt 04-01, first paid 04-15 = 14 days
    expect(r.rows[0]?.avgDaysToFirstPayment).toBe(14);
  });

  it('falls back to invoiceDate when sentAt missing', () => {
    const r = buildCustomerFirstPaymentTiming({
      arInvoices: [ar({ sentAt: undefined, invoiceDate: '2026-04-01' })],
      arPayments: [pay({ receivedOn: '2026-04-15' })],
    });
    expect(r.rows[0]?.avgDaysToFirstPayment).toBe(14);
  });

  it('case-insensitively merges customer names', () => {
    const r = buildCustomerFirstPaymentTiming({
      arInvoices: [
        ar({ id: 'a', customerName: 'Cal Fire' }),
        ar({ id: 'b', customerName: 'CAL FIRE' }),
      ],
      arPayments: [
        pay({ id: 'p1', arInvoiceId: 'a', receivedOn: '2026-04-15' }),
        pay({ id: 'p2', arInvoiceId: 'b', receivedOn: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.invoicesConsidered).toBe(2);
  });

  it('flags slow movers (avg > 45 days)', () => {
    const r = buildCustomerFirstPaymentTiming({
      arInvoices: [
        ar({ id: 'a', customerName: 'Slow', invoiceDate: '2026-01-01', sentAt: '2026-01-01T00:00:00.000Z' }),
        ar({ id: 'b', customerName: 'Quick' }),
      ],
      arPayments: [
        pay({ id: 'p1', arInvoiceId: 'a', receivedOn: '2026-03-15' }),
        pay({ id: 'p2', arInvoiceId: 'b', receivedOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.slowMoverCount).toBe(1);
  });

  it('captures best/worst per customer', () => {
    const r = buildCustomerFirstPaymentTiming({
      arInvoices: [
        ar({ id: 'a' }),
        ar({ id: 'b' }),
        ar({ id: 'c' }),
      ],
      arPayments: [
        pay({ id: 'pa', arInvoiceId: 'a', receivedOn: '2026-04-10' }), // 9 days
        pay({ id: 'pb', arInvoiceId: 'b', receivedOn: '2026-04-30' }), // 29 days
        pay({ id: 'pc', arInvoiceId: 'c', receivedOn: '2026-04-15' }), // 14 days
      ],
    });
    expect(r.rows[0]?.bestDaysToFirstPayment).toBe(9);
    expect(r.rows[0]?.worstDaysToFirstPayment).toBe(29);
  });

  it('rolls up blended average', () => {
    const r = buildCustomerFirstPaymentTiming({
      arInvoices: [
        ar({ id: 'a', customerName: 'A' }),
        ar({ id: 'b', customerName: 'B' }),
      ],
      arPayments: [
        pay({ id: 'pa', arInvoiceId: 'a', receivedOn: '2026-04-11' }), // 10 days
        pay({ id: 'pb', arInvoiceId: 'b', receivedOn: '2026-04-21' }), // 20 days
      ],
    });
    expect(r.rollup.blendedAvgDaysToFirstPayment).toBe(15);
  });

  it('sorts slowest customer first', () => {
    const r = buildCustomerFirstPaymentTiming({
      arInvoices: [
        ar({ id: 'a', customerName: 'Quick' }),
        ar({ id: 'b', customerName: 'Slow', sentAt: '2026-01-01T00:00:00.000Z' }),
      ],
      arPayments: [
        pay({ id: 'pa', arInvoiceId: 'a', receivedOn: '2026-04-11' }),
        pay({ id: 'pb', arInvoiceId: 'b', receivedOn: '2026-03-15' }),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('Slow');
  });
});
