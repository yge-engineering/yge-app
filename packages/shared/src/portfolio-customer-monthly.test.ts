import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';

import { buildPortfolioCustomerMonthly } from './portfolio-customer-monthly';

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

describe('buildPortfolioCustomerMonthly', () => {
  it('sums billed / paid / open / retention per month', () => {
    const r = buildPortfolioCustomerMonthly({
      arInvoices: [
        ar({ totalCents: 100_000_00, paidCents: 30_000_00, retentionCents: 5_000_00 }),
        ar({ id: 'b', totalCents: 50_000_00, paidCents: 50_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalCents).toBe(150_000_00);
    expect(r.rows[0]?.paidCents).toBe(80_000_00);
    expect(r.rows[0]?.openCents).toBe(70_000_00);
    expect(r.rows[0]?.retentionCents).toBe(5_000_00);
  });

  it('counts distinct customers + jobs', () => {
    const r = buildPortfolioCustomerMonthly({
      arInvoices: [
        ar({ id: 'a', customerName: 'CAL FIRE', jobId: 'j1' }),
        ar({ id: 'b', customerName: 'Caltrans', jobId: 'j2' }),
        ar({ id: 'c', customerName: 'CAL FIRE', jobId: 'j1' }),
      ],
    });
    expect(r.rows[0]?.distinctCustomers).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildPortfolioCustomerMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      arInvoices: [
        ar({ id: 'old', invoiceDate: '2026-03-15' }),
        ar({ id: 'in', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalInvoices).toBe(1);
  });

  it('sorts by month asc', () => {
    const r = buildPortfolioCustomerMonthly({
      arInvoices: [
        ar({ id: 'a', invoiceDate: '2026-06-15' }),
        ar({ id: 'b', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[1]?.month).toBe('2026-06');
  });

  it('handles empty input', () => {
    const r = buildPortfolioCustomerMonthly({ arInvoices: [] });
    expect(r.rows).toHaveLength(0);
  });
});
