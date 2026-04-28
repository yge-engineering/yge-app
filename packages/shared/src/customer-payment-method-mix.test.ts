import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';

import { buildCustomerPaymentMethodMix } from './customer-payment-method-mix';

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
    amountCents: 50_000_00,
    ...over,
  } as ArPayment;
}

describe('buildCustomerPaymentMethodMix', () => {
  it('groups payments by customer via invoice join', () => {
    const r = buildCustomerPaymentMethodMix({
      arInvoices: [
        ar({ id: 'ar-a', customerName: 'CAL FIRE' }),
        ar({ id: 'ar-b', customerName: 'Cal Fire' }),
      ],
      arPayments: [
        pay({ id: 'p1', arInvoiceId: 'ar-a' }),
        pay({ id: 'p2', arInvoiceId: 'ar-b' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.totalPayments).toBe(2);
  });

  it('breaks down by method with counts + amounts + shares', () => {
    const r = buildCustomerPaymentMethodMix({
      arInvoices: [ar({ id: 'ar-a' })],
      arPayments: [
        pay({ id: 'p1', arInvoiceId: 'ar-a', method: 'CHECK', amountCents: 60_000_00 }),
        pay({ id: 'p2', arInvoiceId: 'ar-a', method: 'WIRE', amountCents: 40_000_00 }),
      ],
    });
    const row = r.rows[0];
    expect(row?.byMethod.CHECK?.amountCents).toBe(60_000_00);
    expect(row?.byMethod.CHECK?.share).toBe(0.6);
    expect(row?.byMethod.WIRE?.share).toBe(0.4);
  });

  it('captures dominant method by amount', () => {
    const r = buildCustomerPaymentMethodMix({
      arInvoices: [ar({ id: 'ar-a' })],
      arPayments: [
        pay({ id: 'p1', arInvoiceId: 'ar-a', method: 'WIRE', amountCents: 90_000_00 }),
        pay({ id: 'p2', arInvoiceId: 'ar-a', method: 'CHECK', amountCents: 5_000_00 }),
        pay({ id: 'p3', arInvoiceId: 'ar-a', method: 'CHECK', amountCents: 5_000_00 }),
      ],
    });
    expect(r.rows[0]?.dominantMethod).toBe('WIRE');
  });

  it('skips payments with no matching invoice', () => {
    const r = buildCustomerPaymentMethodMix({
      arInvoices: [ar({ id: 'ar-a' })],
      arPayments: [
        pay({ id: 'p1', arInvoiceId: 'orphan' }),
      ],
    });
    expect(r.rollup.totalPayments).toBe(0);
  });

  it('respects fromDate/toDate window', () => {
    const r = buildCustomerPaymentMethodMix({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arInvoices: [ar({ id: 'ar-a' })],
      arPayments: [
        pay({ id: 'old', arInvoiceId: 'ar-a', receivedOn: '2026-03-15' }),
        pay({ id: 'in', arInvoiceId: 'ar-a', receivedOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalPayments).toBe(1);
  });

  it('rolls up portfolio totals + per-method amounts', () => {
    const r = buildCustomerPaymentMethodMix({
      arInvoices: [
        ar({ id: 'ar-a', customerName: 'A' }),
        ar({ id: 'ar-b', customerName: 'B' }),
      ],
      arPayments: [
        pay({ id: 'p1', arInvoiceId: 'ar-a', method: 'CHECK', amountCents: 10_000_00 }),
        pay({ id: 'p2', arInvoiceId: 'ar-b', method: 'WIRE', amountCents: 50_000_00 }),
      ],
    });
    expect(r.rollup.totalPayments).toBe(2);
    expect(r.rollup.totalAmountCents).toBe(60_000_00);
    expect(r.rollup.portfolioByMethod.CHECK).toBe(10_000_00);
    expect(r.rollup.portfolioByMethod.WIRE).toBe(50_000_00);
  });

  it('sorts customers by total amount desc', () => {
    const r = buildCustomerPaymentMethodMix({
      arInvoices: [
        ar({ id: 'ar-small', customerName: 'Small' }),
        ar({ id: 'ar-big', customerName: 'Big' }),
      ],
      arPayments: [
        pay({ id: 's', arInvoiceId: 'ar-small', amountCents: 5_000_00 }),
        pay({ id: 'b', arInvoiceId: 'ar-big', amountCents: 50_000_00 }),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('Big');
  });

  it('handles empty input', () => {
    const r = buildCustomerPaymentMethodMix({ arInvoices: [], arPayments: [] });
    expect(r.rows).toHaveLength(0);
  });
});
