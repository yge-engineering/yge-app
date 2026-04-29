import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';

import { buildCustomerOnTimeMonthly } from './customer-on-time-monthly';

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'j1',
    invoiceNumber: '1',
    customerName: 'CAL FIRE',
    invoiceDate: '2026-04-01',
    source: 'PROGRESS',
    lineItems: [],
    totalCents: 100_000_00,
    paidCents: 100_000_00,
    status: 'PAID',
    dueDate: '2026-04-30',
    ...over,
  } as ArInvoice;
}

function arp(over: Partial<ArPayment>): ArPayment {
  return {
    id: 'arp-1',
    createdAt: '2026-04-30T00:00:00.000Z',
    updatedAt: '2026-04-30T00:00:00.000Z',
    arInvoiceId: 'ar-1',
    jobId: 'j1',
    kind: 'PROGRESS',
    method: 'CHECK',
    receivedOn: '2026-04-30',
    amountCents: 100_000_00,
    ...over,
  } as ArPayment;
}

describe('buildCustomerOnTimeMonthly', () => {
  it('buckets by yyyy-mm of dueDate', () => {
    const r = buildCustomerOnTimeMonthly({
      arInvoices: [
        ar({ id: 'a', dueDate: '2026-03-31' }),
        ar({ id: 'b', dueDate: '2026-04-30' }),
      ],
      arPayments: [
        arp({ id: 'pa', arInvoiceId: 'a', receivedOn: '2026-03-31' }),
        arp({ id: 'pb', arInvoiceId: 'b', receivedOn: '2026-04-30' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('counts on-time vs late', () => {
    const r = buildCustomerOnTimeMonthly({
      arInvoices: [
        ar({ id: 'a', dueDate: '2026-04-30' }),
        ar({ id: 'b', dueDate: '2026-04-30' }),
      ],
      arPayments: [
        arp({ id: 'pa', arInvoiceId: 'a', receivedOn: '2026-04-25' }),
        arp({ id: 'pb', arInvoiceId: 'b', receivedOn: '2026-05-15' }),
      ],
    });
    expect(r.rows[0]?.onTimeCount).toBe(1);
    expect(r.rows[0]?.lateCount).toBe(1);
    expect(r.rows[0]?.onTimeRate).toBe(0.5);
  });

  it('computes avg days late', () => {
    const r = buildCustomerOnTimeMonthly({
      arInvoices: [
        ar({ id: 'a', dueDate: '2026-04-30' }),
        ar({ id: 'b', dueDate: '2026-04-30' }),
      ],
      arPayments: [
        arp({ id: 'pa', arInvoiceId: 'a', receivedOn: '2026-05-10' }),  // 10 days late
        arp({ id: 'pb', arInvoiceId: 'b', receivedOn: '2026-05-20' }),  // 20 days late
      ],
    });
    expect(r.rows[0]?.avgDaysLate).toBe(15);
  });

  it('skips unsettled invoices', () => {
    const r = buildCustomerOnTimeMonthly({
      arInvoices: [ar({ status: 'SENT', paidCents: 0 })],
      arPayments: [],
    });
    expect(r.rollup.totalInvoices).toBe(0);
  });

  it('counts distinct customers per month', () => {
    const r = buildCustomerOnTimeMonthly({
      arInvoices: [
        ar({ id: 'a', customerName: 'A', dueDate: '2026-04-30' }),
        ar({ id: 'b', customerName: 'B', dueDate: '2026-04-30' }),
      ],
      arPayments: [
        arp({ id: 'pa', arInvoiceId: 'a', receivedOn: '2026-04-30' }),
        arp({ id: 'pb', arInvoiceId: 'b', receivedOn: '2026-04-30' }),
      ],
    });
    expect(r.rows[0]?.distinctCustomers).toBe(2);
  });

  it('sorts by month asc', () => {
    const r = buildCustomerOnTimeMonthly({
      arInvoices: [
        ar({ id: 'late', dueDate: '2026-04-30' }),
        ar({ id: 'early', dueDate: '2026-02-28' }),
      ],
      arPayments: [
        arp({ id: 'p1', arInvoiceId: 'late', receivedOn: '2026-04-30' }),
        arp({ id: 'p2', arInvoiceId: 'early', receivedOn: '2026-02-28' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-02');
  });

  it('handles empty input', () => {
    const r = buildCustomerOnTimeMonthly({ arInvoices: [], arPayments: [] });
    expect(r.rows).toHaveLength(0);
  });
});
