import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { ApPayment } from './ap-payment';

import { buildPortfolioApAgingMonthly } from './portfolio-ap-aging-monthly';

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '',
    updatedAt: '',
    vendorName: 'V',
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
    vendorName: 'V',
    method: 'CHECK',
    paidOn: '2026-04-20',
    amountCents: 30_000_00,
    cleared: false,
    voided: false,
    ...over,
  } as ApPayment;
}

describe('buildPortfolioApAgingMonthly', () => {
  it('produces one row per yyyy-mm in the window', () => {
    const r = buildPortfolioApAgingMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-06',
      apInvoices: [],
      apPayments: [],
    });
    expect(r.rows.map((x) => x.month)).toEqual([
      '2026-04',
      '2026-05',
      '2026-06',
    ]);
  });

  it('buckets open AP by age at month-end', () => {
    const r = buildPortfolioApAgingMonthly({
      fromMonth: '2026-06',
      toMonth: '2026-06',
      apInvoices: [
        ap({ id: 'a', invoiceDate: '2026-06-25' }),
        ap({ id: 'b', invoiceDate: '2026-05-15' }),
        ap({ id: 'c', invoiceDate: '2026-04-15' }),
        ap({ id: 'd', invoiceDate: '2026-02-15' }),
      ],
      apPayments: [],
    });
    expect(r.rows[0]?.invoiceCount).toBe(4);
    expect(r.rows[0]?.days1to30Cents).toBe(100_000_00);
    expect(r.rows[0]?.days31to60Cents).toBe(100_000_00);
    expect(r.rows[0]?.days61to90Cents).toBe(100_000_00);
    expect(r.rows[0]?.days90PlusCents).toBe(100_000_00);
  });

  it('subtracts non-voided payments paid on/before snapshot date', () => {
    const r = buildPortfolioApAgingMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      apInvoices: [ap({ id: 'a', totalCents: 100_000_00 })],
      apPayments: [app({ apInvoiceId: 'a', paidOn: '2026-04-20', amountCents: 30_000_00 })],
    });
    expect(r.rows[0]?.openCents).toBe(70_000_00);
  });

  it('ignores voided payments', () => {
    const r = buildPortfolioApAgingMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      apInvoices: [ap({ id: 'a', totalCents: 100_000_00 })],
      apPayments: [app({ apInvoiceId: 'a', amountCents: 30_000_00, voided: true })],
    });
    expect(r.rows[0]?.openCents).toBe(100_000_00);
  });

  it('ignores payments paid after snapshot date', () => {
    const r = buildPortfolioApAgingMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      apInvoices: [ap({ id: 'a', totalCents: 100_000_00 })],
      apPayments: [app({ apInvoiceId: 'a', paidOn: '2026-05-10', amountCents: 30_000_00 })],
    });
    expect(r.rows[0]?.openCents).toBe(100_000_00);
  });

  it('skips invoices issued after snapshot date', () => {
    const r = buildPortfolioApAgingMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      apInvoices: [ap({ id: 'a', invoiceDate: '2026-05-10' })],
      apPayments: [],
    });
    expect(r.rows[0]?.invoiceCount).toBe(0);
  });

  it('handles empty input window', () => {
    const r = buildPortfolioApAgingMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      apInvoices: [],
      apPayments: [],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.openCents).toBe(0);
  });
});
