import { describe, expect, it } from 'vitest';

import type { ChangeOrder } from './change-order';
import type { Job } from './job';
import type { Rfi } from './rfi';

import { buildJobRfiToCoTiming } from './job-rfi-to-co-timing';

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

function rfi(over: Partial<Rfi>): Rfi {
  return {
    id: 'rfi-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'j1',
    rfiNumber: '14',
    subject: 's',
    question: 'q',
    priority: 'MEDIUM',
    status: 'SENT',
    sentAt: '2026-04-01',
    ...over,
  } as Rfi;
}

function co(over: Partial<ChangeOrder>): ChangeOrder {
  return {
    id: 'co-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'j1',
    changeOrderNumber: '1',
    subject: 's',
    description: '',
    reason: 'RFI_RESPONSE',
    status: 'PROPOSED',
    proposedAt: '2026-04-15',
    lineItems: [],
    totalCostImpactCents: 0,
    totalScheduleImpactDays: 0,
    ...over,
  } as ChangeOrder;
}

describe('buildJobRfiToCoTiming', () => {
  it('chains COs that carry originRfiId to their RFI', () => {
    const r = buildJobRfiToCoTiming({
      jobs: [job({})],
      rfis: [rfi({ id: 'rfi-1', sentAt: '2026-04-01' })],
      changeOrders: [
        co({ id: 'co-1', originRfiId: 'rfi-1', proposedAt: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.chainCount).toBe(1);
    expect(r.rows[0]?.chains[0]?.gapDays).toBe(14);
  });

  it('skips COs without originRfiId', () => {
    const r = buildJobRfiToCoTiming({
      jobs: [job({})],
      rfis: [],
      changeOrders: [
        co({ id: 'co-1', originRfiId: undefined }),
      ],
    });
    expect(r.rows[0]?.chainCount).toBe(0);
  });

  it('skips chains where the linked RFI does not exist', () => {
    const r = buildJobRfiToCoTiming({
      jobs: [job({})],
      rfis: [],
      changeOrders: [co({ id: 'co-1', originRfiId: 'missing' })],
    });
    expect(r.rows[0]?.chainCount).toBe(0);
  });

  it('captures longest + median gap', () => {
    const r = buildJobRfiToCoTiming({
      jobs: [job({})],
      rfis: [
        rfi({ id: 'r1', sentAt: '2026-04-01' }),
        rfi({ id: 'r2', sentAt: '2026-04-01' }),
        rfi({ id: 'r3', sentAt: '2026-04-01' }),
      ],
      changeOrders: [
        co({ id: 'c1', originRfiId: 'r1', proposedAt: '2026-04-08' }),  // 7
        co({ id: 'c2', originRfiId: 'r2', proposedAt: '2026-04-15' }),  // 14
        co({ id: 'c3', originRfiId: 'r3', proposedAt: '2026-05-01' }),  // 30
      ],
    });
    expect(r.rows[0]?.medianGapDays).toBe(14);
    expect(r.rows[0]?.longestGapDays).toBe(30);
  });

  it('null gapDays when either date missing', () => {
    const r = buildJobRfiToCoTiming({
      jobs: [job({})],
      rfis: [rfi({ id: 'r1', sentAt: undefined })],
      changeOrders: [co({ id: 'c1', originRfiId: 'r1', proposedAt: '2026-04-15' })],
    });
    expect(r.rows[0]?.chains[0]?.gapDays).toBe(null);
  });

  it('AWARDED-only by default', () => {
    const r = buildJobRfiToCoTiming({
      jobs: [
        job({ id: 'p', status: 'PROSPECT' }),
        job({ id: 'a' }),
      ],
      rfis: [],
      changeOrders: [],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('chains within job sorted by gap desc', () => {
    const r = buildJobRfiToCoTiming({
      jobs: [job({})],
      rfis: [
        rfi({ id: 'r1', sentAt: '2026-04-01' }),
        rfi({ id: 'r2', sentAt: '2026-04-01' }),
      ],
      changeOrders: [
        co({ id: 'short', originRfiId: 'r1', proposedAt: '2026-04-05' }),
        co({ id: 'long', originRfiId: 'r2', proposedAt: '2026-05-01' }),
      ],
    });
    expect(r.rows[0]?.chains[0]?.coId).toBe('long');
  });

  it('rolls up portfolio blended median', () => {
    const r = buildJobRfiToCoTiming({
      jobs: [job({})],
      rfis: [
        rfi({ id: 'r1', sentAt: '2026-04-01' }),
        rfi({ id: 'r2', sentAt: '2026-04-01' }),
      ],
      changeOrders: [
        co({ id: 'c1', originRfiId: 'r1', proposedAt: '2026-04-11' }),
        co({ id: 'c2', originRfiId: 'r2', proposedAt: '2026-04-21' }),
      ],
    });
    expect(r.rollup.blendedMedianGapDays).toBe(15);
  });

  it('handles empty input', () => {
    const r = buildJobRfiToCoTiming({ jobs: [], rfis: [], changeOrders: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.blendedMedianGapDays).toBe(null);
  });
});
