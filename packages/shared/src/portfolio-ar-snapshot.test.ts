import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';

import { buildPortfolioArSnapshot } from './portfolio-ar-snapshot';

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    customerName: 'CAL FIRE',
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

describe('buildPortfolioArSnapshot', () => {
  it('sums billed / paid / open / retention', () => {
    const r = buildPortfolioArSnapshot({
      asOf: '2026-04-30',
      arInvoices: [ar({ id: 'a', totalCents: 100_000_00, retentionCents: 5_000_00 })],
      arPayments: [arp({ arInvoiceId: 'a', amountCents: 30_000_00 })],
    });
    expect(r.totalCents).toBe(100_000_00);
    expect(r.paidCents).toBe(30_000_00);
    expect(r.openCents).toBe(70_000_00);
    expect(r.retentionCents).toBe(5_000_00);
  });

  it('buckets open by age', () => {
    const r = buildPortfolioArSnapshot({
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

  it('counts distinct customers + jobs', () => {
    const r = buildPortfolioArSnapshot({
      asOf: '2026-04-30',
      arInvoices: [
        ar({ id: 'a', customerName: 'CAL FIRE', jobId: 'j1' }),
        ar({ id: 'b', customerName: 'Caltrans', jobId: 'j2' }),
      ],
      arPayments: [],
    });
    expect(r.distinctCustomers).toBe(2);
    expect(r.distinctJobs).toBe(2);
  });

  it('ignores invoices issued after asOf', () => {
    const r = buildPortfolioArSnapshot({
      asOf: '2026-04-30',
      arInvoices: [ar({ id: 'a', invoiceDate: '2026-05-15' })],
      arPayments: [],
    });
    expect(r.invoiceCount).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioArSnapshot({
      asOf: '2026-04-30',
      arInvoices: [],
      arPayments: [],
    });
    expect(r.totalCents).toBe(0);
  });
});
