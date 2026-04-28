import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';

import { buildCustomerOnTimePaidRate } from './customer-on-time-paid-rate';

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
    totalCents: 100_000_00,
    paidCents: 100_000_00,
    status: 'PAID',
    dueDate: '2026-04-30',
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

describe('buildCustomerOnTimePaidRate', () => {
  it('marks payment on or before due date as on time', () => {
    const r = buildCustomerOnTimePaidRate({
      arInvoices: [ar({ id: 'a', dueDate: '2026-04-30' })],
      arPayments: [pay({ id: 'p', arInvoiceId: 'a', receivedOn: '2026-04-30' })],
    });
    expect(r.rows[0]?.onTimeCount).toBe(1);
    expect(r.rows[0]?.lateCount).toBe(0);
  });

  it('measures days late by latest receivedOn', () => {
    const r = buildCustomerOnTimePaidRate({
      arInvoices: [ar({ id: 'a', dueDate: '2026-04-30' })],
      arPayments: [
        pay({ id: 'pa', arInvoiceId: 'a', receivedOn: '2026-04-20' }),
        pay({ id: 'pb', arInvoiceId: 'a', receivedOn: '2026-05-10' }),
      ],
    });
    expect(r.rows[0]?.maxDaysLate).toBe(10);
    expect(r.rows[0]?.avgDaysLate).toBe(10);
  });

  it('skips invoices without a due date', () => {
    const r = buildCustomerOnTimePaidRate({
      arInvoices: [ar({ id: 'a', dueDate: undefined })],
      arPayments: [pay({ id: 'p', arInvoiceId: 'a' })],
    });
    expect(r.rollup.invoicesConsidered).toBe(0);
  });

  it('skips invoices not yet settled', () => {
    const r = buildCustomerOnTimePaidRate({
      arInvoices: [ar({ id: 'a', status: 'SENT', paidCents: 0 })],
      arPayments: [],
    });
    expect(r.rollup.invoicesConsidered).toBe(0);
  });

  it('groups customers by canonicalized name', () => {
    const r = buildCustomerOnTimePaidRate({
      arInvoices: [
        ar({ id: 'a', customerName: 'CAL FIRE' }),
        ar({ id: 'b', customerName: 'Cal Fire, Inc.' }),
      ],
      arPayments: [
        pay({ id: 'pa', arInvoiceId: 'a' }),
        pay({ id: 'pb', arInvoiceId: 'b' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.invoicesConsidered).toBe(2);
  });

  it('sorts by late count desc, then avg days late desc', () => {
    const r = buildCustomerOnTimePaidRate({
      arInvoices: [
        ar({ id: 'a1', customerName: 'Alpha', dueDate: '2026-04-01' }),
        ar({ id: 'a2', customerName: 'Alpha', dueDate: '2026-04-01' }),
        ar({ id: 'b1', customerName: 'Bravo', dueDate: '2026-04-01' }),
      ],
      arPayments: [
        pay({ id: 'pa1', arInvoiceId: 'a1', receivedOn: '2026-04-05' }),
        pay({ id: 'pa2', arInvoiceId: 'a2', receivedOn: '2026-04-08' }),
        pay({ id: 'pb1', arInvoiceId: 'b1', receivedOn: '2026-04-21' }),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('Alpha');
  });

  it('rolls up portfolio on-time rate', () => {
    const r = buildCustomerOnTimePaidRate({
      arInvoices: [
        ar({ id: 'a', dueDate: '2026-04-30', customerName: 'A' }),
        ar({ id: 'b', dueDate: '2026-04-30', customerName: 'B' }),
        ar({ id: 'c', dueDate: '2026-04-30', customerName: 'C' }),
      ],
      arPayments: [
        pay({ id: 'pa', arInvoiceId: 'a', receivedOn: '2026-04-20' }),
        pay({ id: 'pb', arInvoiceId: 'b', receivedOn: '2026-04-25' }),
        pay({ id: 'pc', arInvoiceId: 'c', receivedOn: '2026-05-15' }),
      ],
    });
    expect(r.rollup.invoicesConsidered).toBe(3);
    expect(r.rollup.onTimeCount).toBe(2);
    expect(r.rollup.lateCount).toBe(1);
    expect(r.rollup.portfolioOnTimeRate).toBeCloseTo(0.6667, 3);
  });

  it('respects fromDate/toDate window', () => {
    const r = buildCustomerOnTimePaidRate({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arInvoices: [
        ar({ id: 'in', dueDate: '2026-04-15' }),
        ar({ id: 'out', dueDate: '2026-05-15' }),
      ],
      arPayments: [
        pay({ id: 'pi', arInvoiceId: 'in' }),
        pay({ id: 'po', arInvoiceId: 'out' }),
      ],
    });
    expect(r.rollup.invoicesConsidered).toBe(1);
  });

  it('handles empty input', () => {
    const r = buildCustomerOnTimePaidRate({ arInvoices: [], arPayments: [] });
    expect(r.rows).toHaveLength(0);
  });
});
