import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';
import type { Job } from './job';

import { buildPortfolioBacklogMonthly } from './portfolio-backlog-monthly';

function job(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    projectName: 'Test',
    projectType: 'ROAD_RECONSTRUCTION',
    contractType: 'PUBLIC',
    status: 'AWARDED',
    engineersEstimateCents: 1_000_000_00,
    ...over,
  } as Job;
}

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    customerName: 'X',
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

describe('buildPortfolioBacklogMonthly', () => {
  it('produces one row per yyyy-mm in the window', () => {
    const r = buildPortfolioBacklogMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-06',
      jobs: [],
      arInvoices: [],
    });
    expect(r.rows.map((x) => x.month)).toEqual([
      '2026-04',
      '2026-05',
      '2026-06',
    ]);
  });

  it('sums contract value of AWARDED jobs only', () => {
    const r = buildPortfolioBacklogMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      jobs: [
        job({ id: 'a', status: 'AWARDED', engineersEstimateCents: 500_000_00 }),
        job({ id: 'b', status: 'PURSUING', engineersEstimateCents: 400_000_00 }),
        job({ id: 'c', status: 'AWARDED', engineersEstimateCents: 200_000_00 }),
      ],
      arInvoices: [],
    });
    expect(r.rows[0]?.awardedJobs).toBe(2);
    expect(r.rows[0]?.contractValueCents).toBe(700_000_00);
  });

  it('subtracts AR billed to date for awarded jobs only', () => {
    const r = buildPortfolioBacklogMonthly({
      fromMonth: '2026-05',
      toMonth: '2026-05',
      jobs: [job({ id: 'a', engineersEstimateCents: 1_000_000_00 })],
      arInvoices: [
        ar({ id: 'a', jobId: 'a', invoiceDate: '2026-04-15', totalCents: 200_000_00 }),
        ar({ id: 'b', jobId: 'a', invoiceDate: '2026-05-10', totalCents: 100_000_00 }),
      ],
    });
    expect(r.rows[0]?.billedToDateCents).toBe(300_000_00);
    expect(r.rows[0]?.backlogCents).toBe(700_000_00);
  });

  it('ignores AR billed after snapshot date', () => {
    const r = buildPortfolioBacklogMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      jobs: [job({ id: 'a', engineersEstimateCents: 1_000_000_00 })],
      arInvoices: [
        ar({ id: 'a', jobId: 'a', invoiceDate: '2026-05-15', totalCents: 200_000_00 }),
      ],
    });
    expect(r.rows[0]?.billedToDateCents).toBe(0);
  });

  it('skips jobs whose createdAt is after snapshot date', () => {
    const r = buildPortfolioBacklogMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      jobs: [
        job({
          id: 'a',
          createdAt: '2026-05-15T00:00:00.000Z',
          engineersEstimateCents: 500_000_00,
        }),
      ],
      arInvoices: [],
    });
    expect(r.rows[0]?.awardedJobs).toBe(0);
  });

  it('handles empty input window', () => {
    const r = buildPortfolioBacklogMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      jobs: [],
      arInvoices: [],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.backlogCents).toBe(0);
  });
});
