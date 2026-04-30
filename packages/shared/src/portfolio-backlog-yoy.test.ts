import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';
import type { Job } from './job';

import { buildPortfolioBacklogYoy } from './portfolio-backlog-yoy';

function job(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '2025-01-15T00:00:00.000Z',
    updatedAt: '2025-01-15T00:00:00.000Z',
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

describe('buildPortfolioBacklogYoy', () => {
  it('compares year-end backlog', () => {
    const r = buildPortfolioBacklogYoy({
      currentYear: 2026,
      jobs: [job({ id: 'a', engineersEstimateCents: 1_000_000_00 })],
      arInvoices: [
        ar({ id: 'ar-1', jobId: 'a', invoiceDate: '2025-06-15', totalCents: 200_000_00 }),
        ar({ id: 'ar-2', jobId: 'a', invoiceDate: '2026-06-15', totalCents: 300_000_00 }),
      ],
    });
    expect(r.prior.backlogCents).toBe(800_000_00);
    expect(r.current.backlogCents).toBe(500_000_00);
    expect(r.backlogCentsDelta).toBe(-300_000_00);
  });

  it('only counts awarded jobs', () => {
    const r = buildPortfolioBacklogYoy({
      currentYear: 2026,
      jobs: [
        job({ id: 'a', status: 'AWARDED', engineersEstimateCents: 500_000_00 }),
        job({ id: 'b', status: 'PURSUING', engineersEstimateCents: 400_000_00 }),
      ],
      arInvoices: [],
    });
    expect(r.current.awardedJobs).toBe(1);
    expect(r.current.contractValueCents).toBe(500_000_00);
  });

  it('skips jobs whose createdAt is after snapshot date', () => {
    const r = buildPortfolioBacklogYoy({
      currentYear: 2026,
      jobs: [job({ id: 'a', createdAt: '2027-01-15T00:00:00Z' })],
      arInvoices: [],
    });
    expect(r.current.awardedJobs).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioBacklogYoy({
      currentYear: 2026,
      jobs: [],
      arInvoices: [],
    });
    expect(r.current.backlogCents).toBe(0);
  });
});
