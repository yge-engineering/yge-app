import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';
import type { Job } from './job';

import { buildPortfolioBacklogSnapshot } from './portfolio-backlog-snapshot';

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

describe('buildPortfolioBacklogSnapshot', () => {
  it('computes awarded value minus billed', () => {
    const r = buildPortfolioBacklogSnapshot({
      asOf: '2026-04-30',
      jobs: [job({ id: 'a', engineersEstimateCents: 1_000_000_00 })],
      arInvoices: [
        ar({ id: 'i1', jobId: 'a', invoiceDate: '2026-04-15', totalCents: 200_000_00 }),
      ],
    });
    expect(r.awardedJobs).toBe(1);
    expect(r.contractValueCents).toBe(1_000_000_00);
    expect(r.billedToDateCents).toBe(200_000_00);
    expect(r.backlogCents).toBe(800_000_00);
  });

  it('only counts AWARDED jobs', () => {
    const r = buildPortfolioBacklogSnapshot({
      asOf: '2026-04-30',
      jobs: [
        job({ id: 'a', status: 'AWARDED', engineersEstimateCents: 500_000_00 }),
        job({ id: 'b', status: 'PURSUING', engineersEstimateCents: 400_000_00 }),
      ],
      arInvoices: [],
    });
    expect(r.awardedJobs).toBe(1);
    expect(r.contractValueCents).toBe(500_000_00);
  });

  it('ignores AR billed after asOf', () => {
    const r = buildPortfolioBacklogSnapshot({
      asOf: '2026-04-30',
      jobs: [job({ id: 'a', engineersEstimateCents: 1_000_000_00 })],
      arInvoices: [
        ar({ id: 'late', jobId: 'a', invoiceDate: '2026-05-15', totalCents: 200_000_00 }),
      ],
    });
    expect(r.billedToDateCents).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioBacklogSnapshot({
      asOf: '2026-04-30',
      jobs: [],
      arInvoices: [],
    });
    expect(r.backlogCents).toBe(0);
  });
});
