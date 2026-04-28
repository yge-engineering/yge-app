import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Job } from './job';

import { buildJobApApprovalCycle } from './job-ap-approval-cycle';

function job(over: Partial<Pick<Job, 'id' | 'projectName' | 'status'>>): Pick<
  Job,
  'id' | 'projectName' | 'status'
> {
  return {
    id: 'j1',
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
    vendorName: 'Acme',
    invoiceDate: '2026-04-01',
    jobId: 'j1',
    lineItems: [],
    totalCents: 100_00,
    paidCents: 0,
    status: 'APPROVED',
    approvedAt: '2026-04-08T00:00:00.000Z',
    ...over,
  } as ApInvoice;
}

describe('buildJobApApprovalCycle', () => {
  it('computes cycle days from createdAt to approvedAt', () => {
    const r = buildJobApApprovalCycle({
      jobs: [job({})],
      apInvoices: [
        ap({ id: 'a', createdAt: '2026-04-01T00:00:00.000Z', approvedAt: '2026-04-08T00:00:00.000Z' }),
      ],
    });
    expect(r.rows[0]?.approvedCount).toBe(1);
    expect(r.rows[0]?.medianCycleDays).toBe(7);
  });

  it('counts PENDING invoices separately', () => {
    const r = buildJobApApprovalCycle({
      jobs: [job({})],
      apInvoices: [
        ap({ id: 'p', status: 'PENDING', approvedAt: undefined }),
        ap({ id: 'a' }),
      ],
    });
    expect(r.rows[0]?.pendingCount).toBe(1);
    expect(r.rows[0]?.approvedCount).toBe(1);
  });

  it('skips DRAFT + REJECTED', () => {
    const r = buildJobApApprovalCycle({
      jobs: [job({})],
      apInvoices: [
        ap({ id: 'd', status: 'DRAFT', approvedAt: undefined }),
        ap({ id: 'r', status: 'REJECTED', approvedAt: undefined }),
      ],
    });
    expect(r.rows[0]?.approvedCount).toBe(0);
    expect(r.rows[0]?.pendingCount).toBe(0);
  });

  it('skips invoices without jobId', () => {
    const r = buildJobApApprovalCycle({
      jobs: [job({})],
      apInvoices: [ap({ id: 'a', jobId: undefined })],
    });
    expect(r.rows[0]?.approvedCount).toBe(0);
  });

  it('captures longest + mean', () => {
    const r = buildJobApApprovalCycle({
      jobs: [job({})],
      apInvoices: [
        ap({ id: 'a', createdAt: '2026-04-01T00:00:00.000Z', approvedAt: '2026-04-04T00:00:00.000Z' }), // 3
        ap({ id: 'b', createdAt: '2026-04-01T00:00:00.000Z', approvedAt: '2026-04-08T00:00:00.000Z' }), // 7
        ap({ id: 'c', createdAt: '2026-04-01T00:00:00.000Z', approvedAt: '2026-04-15T00:00:00.000Z' }), // 14
      ],
    });
    expect(r.rows[0]?.longestCycleDays).toBe(14);
    expect(r.rows[0]?.meanCycleDays).toBe(8);
  });

  it('AWARDED-only by default', () => {
    const r = buildJobApApprovalCycle({
      jobs: [
        job({ id: 'p', status: 'PROSPECT' }),
        job({ id: 'a' }),
      ],
      apInvoices: [],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sorts slowest median first', () => {
    const r = buildJobApApprovalCycle({
      jobs: [
        job({ id: 'fast' }),
        job({ id: 'slow' }),
      ],
      apInvoices: [
        ap({ id: 'f', jobId: 'fast', createdAt: '2026-04-01T00:00:00.000Z', approvedAt: '2026-04-03T00:00:00.000Z' }),
        ap({ id: 's', jobId: 'slow', createdAt: '2026-04-01T00:00:00.000Z', approvedAt: '2026-05-01T00:00:00.000Z' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('slow');
  });

  it('rolls up portfolio blended median', () => {
    const r = buildJobApApprovalCycle({
      jobs: [job({})],
      apInvoices: [
        ap({ id: 'a', createdAt: '2026-04-01T00:00:00.000Z', approvedAt: '2026-04-04T00:00:00.000Z' }),
        ap({ id: 'b', createdAt: '2026-04-01T00:00:00.000Z', approvedAt: '2026-04-08T00:00:00.000Z' }),
        ap({ id: 'c', createdAt: '2026-04-01T00:00:00.000Z', approvedAt: '2026-04-15T00:00:00.000Z' }),
      ],
    });
    expect(r.rollup.blendedMedianDays).toBe(7);
  });

  it('handles empty input', () => {
    const r = buildJobApApprovalCycle({ jobs: [], apInvoices: [] });
    expect(r.rows).toHaveLength(0);
  });
});
