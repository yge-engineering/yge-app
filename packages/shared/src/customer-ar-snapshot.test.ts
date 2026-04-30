import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';

import { buildCustomerArSnapshot } from './customer-ar-snapshot';

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    customerName: 'Caltrans',
    invoiceDate: '2026-04-15',
    invoiceNumber: '1',
    lineItems: [],
    subtotalCents: 0,
    totalCents: 100_000_00,
    paidCents: 0,
    status: 'SENT',
    source: 'MANUAL',
    ...over,
  } as ArInvoice;
}

function arp(over: Partial<ArPayment>): ArPayment {
  return {
    id: 'p1',
    createdAt: '',
    updatedAt: '',
    arInvoiceId: 'ar-1',
    jobId: 'j1',
    kind: 'PROGRESS',
    method: 'CHECK',
    receivedOn: '2026-04-25',
    amountCents: 30_000_00,
    payerName: 'X',
    ...over,
  } as ArPayment;
}

describe('buildCustomerArSnapshot', () => {
  it('filters invoices to one customer', () => {
    const r = buildCustomerArSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      arInvoices: [
        ar({ id: 'a', customerName: 'Caltrans', totalCents: 100_000_00 }),
        ar({ id: 'b', customerName: 'CAL FIRE', totalCents: 50_000_00 }),
      ],
      arPayments: [],
    });
    expect(r.invoiceCount).toBe(1);
    expect(r.totalCents).toBe(100_000_00);
  });

  it('sums billed/paid/open/retention', () => {
    const r = buildCustomerArSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      arInvoices: [ar({ id: 'a', totalCents: 100_000_00, retentionCents: 5_000_00 })],
      arPayments: [arp({ arInvoiceId: 'a', amountCents: 30_000_00 })],
    });
    expect(r.paidCents).toBe(30_000_00);
    expect(r.openCents).toBe(70_000_00);
    expect(r.retentionCents).toBe(5_000_00);
  });

  it('buckets open by age', () => {
    const r = buildCustomerArSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-06-30',
      arInvoices: [
        ar({ id: 'a', invoiceDate: '2026-06-25' }),
        ar({ id: 'b', invoiceDate: '2026-05-25' }),
        ar({ id: 'c', invoiceDate: '2026-04-25' }),
        ar({ id: 'd', invoiceDate: '2026-02-25' }),
      ],
      arPayments: [],
    });
    expect(r.openInvoiceCount).toBe(4);
    expect(r.days1to30Cents).toBe(100_000_00);
    expect(r.days31to60Cents).toBe(100_000_00);
    expect(r.days61to90Cents).toBe(100_000_00);
    expect(r.days90PlusCents).toBe(100_000_00);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerArSnapshot({
      customerName: 'NonExistent',
      arInvoices: [],
      arPayments: [],
    });
    expect(r.totalCents).toBe(0);
  });
});
