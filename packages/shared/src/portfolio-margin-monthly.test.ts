import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { ArInvoice } from './ar-invoice';
import type { Job } from './job';

import { buildPortfolioMarginMonthly } from './portfolio-margin-monthly';

function job(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '',
    updatedAt: '',
    projectName: 'Test',
    projectType: 'ROAD_RECONSTRUCTION',
    contractType: 'PUBLIC',
    status: 'AWARDED',
    ownerAgency: 'Caltrans D2',
    ...over,
  } as Job;
}

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    customerName: 'Caltrans D2',
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

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '',
    updatedAt: '',
    vendorName: 'V',
    invoiceDate: '2026-04-15',
    jobId: 'j1',
    lineItems: [],
    totalCents: 30_000_00,
    paidCents: 0,
    status: 'PENDING',
    ...over,
  } as ApInvoice;
}

describe('buildPortfolioMarginMonthly', () => {
  it('groups by month with margin computed', () => {
    const r = buildPortfolioMarginMonthly({
      jobs: [job({ id: 'j1' })],
      arInvoices: [ar({ totalCents: 100_000_00 })],
      apInvoices: [ap({ totalCents: 30_000_00 })],
      expenses: [],
    });
    expect(r.rows[0]?.billedCents).toBe(100_000_00);
    expect(r.rows[0]?.costCents).toBe(30_000_00);
    expect(r.rows[0]?.marginCents).toBe(70_000_00);
    expect(r.rows[0]?.marginPct).toBe(0.7);
  });

  it('computes cumulative running totals', () => {
    const r = buildPortfolioMarginMonthly({
      jobs: [job({ id: 'j1' })],
      arInvoices: [
        ar({ id: 'a', invoiceDate: '2026-04-15', totalCents: 100_000_00 }),
        ar({ id: 'b', invoiceDate: '2026-05-15', totalCents: 50_000_00 }),
      ],
      apInvoices: [
        ap({ id: 'x', invoiceDate: '2026-04-15', totalCents: 30_000_00 }),
        ap({ id: 'y', invoiceDate: '2026-05-15', totalCents: 20_000_00 }),
      ],
      expenses: [],
    });
    expect(r.rows[0]?.cumulativeBilledCents).toBe(100_000_00);
    expect(r.rows[1]?.cumulativeBilledCents).toBe(150_000_00);
    expect(r.rows[1]?.cumulativeMarginCents).toBe(100_000_00);
  });

  it('counts distinct jobs + customers', () => {
    const r = buildPortfolioMarginMonthly({
      jobs: [
        job({ id: 'j1', ownerAgency: 'Caltrans D2' }),
        job({ id: 'j2', ownerAgency: 'CAL FIRE' }),
      ],
      arInvoices: [
        ar({ id: 'a', jobId: 'j1' }),
        ar({ id: 'b', jobId: 'j2' }),
      ],
      apInvoices: [],
      expenses: [],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
    expect(r.rows[0]?.distinctCustomers).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildPortfolioMarginMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      jobs: [job({ id: 'j1' })],
      arInvoices: [
        ar({ id: 'old', invoiceDate: '2026-03-15' }),
        ar({ id: 'in', invoiceDate: '2026-04-15' }),
      ],
      apInvoices: [],
      expenses: [],
    });
    expect(r.rollup.billedCents).toBe(100_000_00);
  });

  it('rolls up portfolio totals + portfolio marginPct', () => {
    const r = buildPortfolioMarginMonthly({
      jobs: [job({ id: 'j1' })],
      arInvoices: [ar({ totalCents: 100_000_00 })],
      apInvoices: [ap({ totalCents: 25_000_00 })],
      expenses: [],
    });
    expect(r.rollup.billedCents).toBe(100_000_00);
    expect(r.rollup.costCents).toBe(25_000_00);
    expect(r.rollup.marginCents).toBe(75_000_00);
    expect(r.rollup.marginPct).toBe(0.75);
  });

  it('sorts by month asc', () => {
    const r = buildPortfolioMarginMonthly({
      jobs: [job({ id: 'j1' })],
      arInvoices: [
        ar({ id: 'a', invoiceDate: '2026-06-15' }),
        ar({ id: 'b', invoiceDate: '2026-04-15' }),
        ar({ id: 'c', invoiceDate: '2026-05-15' }),
      ],
      apInvoices: [],
      expenses: [],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[2]?.month).toBe('2026-06');
  });

  it('handles empty input', () => {
    const r = buildPortfolioMarginMonthly({
      jobs: [],
      arInvoices: [],
      apInvoices: [],
      expenses: [],
    });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.marginPct).toBeNull();
  });
});
