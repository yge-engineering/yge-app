import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { ApPayment } from './ap-payment';

import { buildPortfolioApSnapshot } from './portfolio-ap-snapshot';

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

function app(over: Partial<ApPayment>): ApPayment {
  return {
    id: 'app-1',
    createdAt: '',
    updatedAt: '',
    apInvoiceId: 'ap-1',
    vendorName: 'Granite',
    method: 'CHECK',
    paidOn: '2026-04-25',
    amountCents: 30_000_00,
    cleared: false,
    voided: false,
    ...over,
  } as ApPayment;
}

describe('buildPortfolioApSnapshot', () => {
  it('sums billed / paid / open', () => {
    const r = buildPortfolioApSnapshot({
      asOf: '2026-04-30',
      apInvoices: [ap({ id: 'a', totalCents: 100_000_00 })],
      apPayments: [app({ apInvoiceId: 'a', amountCents: 30_000_00 })],
    });
    expect(r.totalCents).toBe(100_000_00);
    expect(r.paidCents).toBe(30_000_00);
    expect(r.openCents).toBe(70_000_00);
  });

  it('skips voided + post-asOf payments', () => {
    const r = buildPortfolioApSnapshot({
      asOf: '2026-04-30',
      apInvoices: [ap({ id: 'a', totalCents: 100_000_00 })],
      apPayments: [
        app({ id: 'live', apInvoiceId: 'a', amountCents: 30_000_00 }),
        app({ id: 'gone', apInvoiceId: 'a', amountCents: 50_000_00, voided: true }),
        app({ id: 'late', apInvoiceId: 'a', amountCents: 10_000_00, paidOn: '2026-05-15' }),
      ],
    });
    expect(r.paidCents).toBe(30_000_00);
  });

  it('buckets open by age', () => {
    const r = buildPortfolioApSnapshot({
      asOf: '2026-06-30',
      apInvoices: [
        ap({ id: 'a', invoiceDate: '2026-06-25' }),
        ap({ id: 'b', invoiceDate: '2026-05-25' }),
        ap({ id: 'c', invoiceDate: '2026-04-25' }),
        ap({ id: 'd', invoiceDate: '2026-02-25' }),
      ],
      apPayments: [],
    });
    expect(r.days1to30Cents).toBe(100_000_00);
    expect(r.days31to60Cents).toBe(100_000_00);
    expect(r.days61to90Cents).toBe(100_000_00);
    expect(r.days90PlusCents).toBe(100_000_00);
  });

  it('counts distinct vendors + jobs', () => {
    const r = buildPortfolioApSnapshot({
      asOf: '2026-04-30',
      apInvoices: [
        ap({ id: 'a', vendorName: 'Granite', jobId: 'j1' }),
        ap({ id: 'b', vendorName: 'Granite, Inc', jobId: 'j2' }),
        ap({ id: 'c', vendorName: 'Bob Trucking', jobId: 'j1' }),
      ],
      apPayments: [],
    });
    expect(r.distinctVendors).toBe(2);
    expect(r.distinctJobs).toBe(2);
  });

  it('handles empty input', () => {
    const r = buildPortfolioApSnapshot({
      asOf: '2026-04-30',
      apInvoices: [],
      apPayments: [],
    });
    expect(r.totalCents).toBe(0);
  });
});
