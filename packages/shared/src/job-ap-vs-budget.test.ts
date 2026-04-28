import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Job } from './job';

import { buildJobApVsBudget } from './job-ap-vs-budget';

function job(over: Partial<Pick<Job, 'id' | 'projectName' | 'status'>>): Pick<
  Job,
  'id' | 'projectName' | 'status'
> {
  return {
    id: 'job-1',
    projectName: 'Sulphur Springs',
    status: 'AWARDED',
    ...over,
  };
}

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    vendorName: 'Acme Supply',
    invoiceDate: '2026-04-01',
    jobId: 'job-1',
    lineItems: [],
    totalCents: 100_000_00,
    paidCents: 0,
    status: 'APPROVED',
    ...over,
  } as ApInvoice;
}

describe('buildJobApVsBudget', () => {
  it('flags NO_BUDGET when no budget supplied', () => {
    const r = buildJobApVsBudget({
      jobs: [job({})],
      apInvoices: [],
      budgetByJobId: new Map(),
    });
    expect(r.rows[0]?.flag).toBe('NO_BUDGET');
  });

  it('flags UNDER below 80%', () => {
    const r = buildJobApVsBudget({
      jobs: [job({})],
      apInvoices: [ap({ totalCents: 500_000_00 })],
      budgetByJobId: new Map([['job-1', 1_000_000_00]]),
    });
    expect(r.rows[0]?.flag).toBe('UNDER');
    expect(r.rows[0]?.consumedPct).toBe(0.5);
  });

  it('flags NEAR_BUDGET 80-100%', () => {
    const r = buildJobApVsBudget({
      jobs: [job({})],
      apInvoices: [ap({ totalCents: 900_000_00 })],
      budgetByJobId: new Map([['job-1', 1_000_000_00]]),
    });
    expect(r.rows[0]?.flag).toBe('NEAR_BUDGET');
  });

  it('flags OVER 100-115%', () => {
    const r = buildJobApVsBudget({
      jobs: [job({})],
      apInvoices: [ap({ totalCents: 1_100_000_00 })],
      budgetByJobId: new Map([['job-1', 1_000_000_00]]),
    });
    expect(r.rows[0]?.flag).toBe('OVER');
  });

  it('flags BLOWN >115%', () => {
    const r = buildJobApVsBudget({
      jobs: [job({})],
      apInvoices: [ap({ totalCents: 1_300_000_00 })],
      budgetByJobId: new Map([['job-1', 1_000_000_00]]),
    });
    expect(r.rows[0]?.flag).toBe('BLOWN');
  });

  it('skips DRAFT and REJECTED AP invoices', () => {
    const r = buildJobApVsBudget({
      jobs: [job({})],
      apInvoices: [
        ap({ id: 'd', status: 'DRAFT', totalCents: 99_000_00 }),
        ap({ id: 'r', status: 'REJECTED', totalCents: 99_000_00 }),
      ],
      budgetByJobId: new Map([['job-1', 1_000_000_00]]),
    });
    expect(r.rows[0]?.apToDateCents).toBe(0);
  });

  it('skips AP without jobId', () => {
    const r = buildJobApVsBudget({
      jobs: [job({})],
      apInvoices: [ap({ jobId: undefined, totalCents: 99_000_00 })],
      budgetByJobId: new Map([['job-1', 1_000_000_00]]),
    });
    expect(r.rows[0]?.apToDateCents).toBe(0);
  });

  it('skips non-AWARDED jobs by default', () => {
    const r = buildJobApVsBudget({
      jobs: [
        job({ id: 'p', status: 'PROSPECT' }),
        job({ id: 'a' }),
      ],
      apInvoices: [],
      budgetByJobId: new Map(),
    });
    expect(r.rows).toHaveLength(1);
  });

  it('rolls up overage across OVER + BLOWN', () => {
    const r = buildJobApVsBudget({
      jobs: [
        job({ id: 'over' }),
        job({ id: 'blown' }),
        job({ id: 'under' }),
      ],
      apInvoices: [
        ap({ id: 'a', jobId: 'over', totalCents: 110_000_00 }),
        ap({ id: 'b', jobId: 'blown', totalCents: 130_000_00 }),
        ap({ id: 'c', jobId: 'under', totalCents: 50_000_00 }),
      ],
      budgetByJobId: new Map([
        ['over', 100_000_00],
        ['blown', 100_000_00],
        ['under', 100_000_00],
      ]),
    });
    expect(r.rollup.totalOverageCents).toBe(40_000_00);
  });

  it('sorts BLOWN first', () => {
    const r = buildJobApVsBudget({
      jobs: [
        job({ id: 'under' }),
        job({ id: 'blown' }),
      ],
      apInvoices: [
        ap({ id: 'a', jobId: 'under', totalCents: 50_000_00 }),
        ap({ id: 'b', jobId: 'blown', totalCents: 130_000_00 }),
      ],
      budgetByJobId: new Map([
        ['under', 100_000_00],
        ['blown', 100_000_00],
      ]),
    });
    expect(r.rows[0]?.jobId).toBe('blown');
  });
});
