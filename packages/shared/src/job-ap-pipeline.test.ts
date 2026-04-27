import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Job } from './job';

import { buildJobApPipeline } from './job-ap-pipeline';

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
    totalCents: 10_000_00,
    paidCents: 0,
    status: 'PENDING',
    ...over,
  } as ApInvoice;
}

describe('buildJobApPipeline', () => {
  it('returns zeros when job has no AP', () => {
    const r = buildJobApPipeline({
      asOf: '2026-04-27',
      jobs: [job({})],
      apInvoices: [],
    });
    expect(r.rows[0]?.pendingCount).toBe(0);
    expect(r.rows[0]?.unpaidBalanceCents).toBe(0);
  });

  it('counts each status independently', () => {
    const r = buildJobApPipeline({
      asOf: '2026-04-27',
      jobs: [job({})],
      apInvoices: [
        ap({ id: 'p1', status: 'PENDING', totalCents: 10_000_00 }),
        ap({ id: 'p2', status: 'PENDING', totalCents: 5_000_00 }),
        ap({ id: 'a1', status: 'APPROVED', totalCents: 20_000_00 }),
        ap({ id: 'pd1', status: 'PAID', totalCents: 30_000_00, paidCents: 30_000_00 }),
        ap({ id: 'r1', status: 'REJECTED', totalCents: 99_000_00 }),
        ap({ id: 'd1', status: 'DRAFT', totalCents: 99_000_00 }),
      ],
    });
    expect(r.rows[0]?.pendingCount).toBe(2);
    expect(r.rows[0]?.pendingTotalCents).toBe(15_000_00);
    expect(r.rows[0]?.approvedCount).toBe(1);
    expect(r.rows[0]?.approvedTotalCents).toBe(20_000_00);
    expect(r.rows[0]?.paidCount).toBe(1);
    expect(r.rows[0]?.paidTotalCents).toBe(30_000_00);
    expect(r.rows[0]?.rejectedCount).toBe(1);
    expect(r.rows[0]?.draftCount).toBe(1);
  });

  it('computes unpaid balance from PENDING + APPROVED open balances', () => {
    const r = buildJobApPipeline({
      asOf: '2026-04-27',
      jobs: [job({})],
      apInvoices: [
        ap({ id: 'p1', status: 'PENDING', totalCents: 10_000_00, paidCents: 0 }),
        ap({ id: 'a1', status: 'APPROVED', totalCents: 5_000_00, paidCents: 1_000_00 }),
      ],
    });
    expect(r.rows[0]?.unpaidBalanceCents).toBe(14_000_00);
  });

  it('captures lastPaidAt + daysSinceLastPaid', () => {
    const r = buildJobApPipeline({
      asOf: '2026-04-27',
      jobs: [job({})],
      apInvoices: [
        ap({ id: 'pd1', status: 'PAID', paidAt: '2026-04-10T00:00:00.000Z' }),
        ap({ id: 'pd2', status: 'PAID', paidAt: '2026-04-20T00:00:00.000Z' }),
      ],
    });
    expect(r.rows[0]?.lastPaidAt).toBe('2026-04-20');
    expect(r.rows[0]?.daysSinceLastPaid).toBe(7);
  });

  it('null daysSinceLastPaid when no paid invoices', () => {
    const r = buildJobApPipeline({
      asOf: '2026-04-27',
      jobs: [job({})],
      apInvoices: [ap({ status: 'PENDING' })],
    });
    expect(r.rows[0]?.lastPaidAt).toBe(null);
    expect(r.rows[0]?.daysSinceLastPaid).toBe(null);
  });

  it('skips AP invoices without jobId', () => {
    const r = buildJobApPipeline({
      asOf: '2026-04-27',
      jobs: [job({})],
      apInvoices: [ap({ jobId: undefined, totalCents: 99_000_00 })],
    });
    expect(r.rows[0]?.pendingCount).toBe(0);
  });

  it('skips non-AWARDED jobs by default', () => {
    const r = buildJobApPipeline({
      asOf: '2026-04-27',
      jobs: [
        job({ id: 'j-prosp', status: 'PROSPECT' }),
        job({ id: 'j-awd' }),
      ],
      apInvoices: [],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.jobId).toBe('j-awd');
  });

  it('rolls up totals across jobs', () => {
    const r = buildJobApPipeline({
      asOf: '2026-04-27',
      jobs: [job({ id: 'j1' }), job({ id: 'j2' })],
      apInvoices: [
        ap({ id: 'p1', jobId: 'j1', status: 'PENDING', totalCents: 10_000_00 }),
        ap({ id: 'a1', jobId: 'j2', status: 'APPROVED', totalCents: 20_000_00 }),
      ],
    });
    expect(r.rollup.totalPendingCents).toBe(10_000_00);
    expect(r.rollup.totalApprovedCents).toBe(20_000_00);
    expect(r.rollup.totalUnpaidBalanceCents).toBe(30_000_00);
  });

  it('sorts highest unpaid balance first', () => {
    const r = buildJobApPipeline({
      asOf: '2026-04-27',
      jobs: [job({ id: 'j-small' }), job({ id: 'j-big' })],
      apInvoices: [
        ap({ id: 'small', jobId: 'j-small', status: 'PENDING', totalCents: 1_000_00 }),
        ap({ id: 'big', jobId: 'j-big', status: 'PENDING', totalCents: 50_000_00 }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('j-big');
  });
});
