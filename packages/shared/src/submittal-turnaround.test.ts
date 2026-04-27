import { describe, expect, it } from 'vitest';
import { buildSubmittalTurnaround } from './submittal-turnaround';
import type { Submittal } from './submittal';

function s(over: Partial<Submittal>): Submittal {
  return {
    id: 'sub-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'job-1',
    submittalNumber: '1',
    subject: 'rebar shop drawings',
    kind: 'SHOP_DRAWING',
    status: 'APPROVED',
    blocksOrdering: false,
    submittedAt: '2026-04-01',
    returnedAt: '2026-04-15',
    submittedTo: 'Engineer A',
    ...over,
  } as Submittal;
}

describe('buildSubmittalTurnaround', () => {
  it('rolls turnaround per reviewer', () => {
    const r = buildSubmittalTurnaround({
      submittals: [
        s({ id: '1', submittedTo: 'A', submittedAt: '2026-04-01', returnedAt: '2026-04-15' }), // 14 days
        s({ id: '2', submittedTo: 'A', submittedAt: '2026-04-10', returnedAt: '2026-04-20' }), // 10 days
        s({ id: '3', submittedTo: 'B', submittedAt: '2026-04-01', returnedAt: '2026-04-30' }), // 29 days
      ],
    });
    const a = r.byReviewer.find((x) => x.reviewer === 'A')!;
    expect(a.closedCount).toBe(2);
    expect(a.meanTurnaroundDays).toBe(12);
    expect(a.minTurnaroundDays).toBe(10);
    expect(a.maxTurnaroundDays).toBe(14);
    const b = r.byReviewer.find((x) => x.reviewer === 'B')!;
    expect(b.meanTurnaroundDays).toBe(29);
  });

  it('counts APPROVED + APPROVED_AS_NOTED as approved; REVISE/REJECTED as rework', () => {
    const r = buildSubmittalTurnaround({
      submittals: [
        s({ id: '1', status: 'APPROVED' }),
        s({ id: '2', status: 'APPROVED_AS_NOTED' }),
        s({ id: '3', status: 'REVISE_RESUBMIT' }),
        s({ id: '4', status: 'REJECTED' }),
      ],
    });
    expect(r.totalApproved).toBe(2);
    expect(r.totalRework).toBe(2);
    expect(r.blendedFirstPassApprovalRate).toBe(0.5);
  });

  it('skips DRAFT, SUBMITTED, WITHDRAWN', () => {
    const r = buildSubmittalTurnaround({
      submittals: [
        s({ id: '1', status: 'DRAFT' }),
        s({ id: '2', status: 'SUBMITTED' }),
        s({ id: '3', status: 'WITHDRAWN' }),
        s({ id: '4', status: 'APPROVED' }),
      ],
    });
    expect(r.closedConsidered).toBe(1);
  });

  it('skips closed submittals missing submittedAt or returnedAt', () => {
    const r = buildSubmittalTurnaround({
      submittals: [
        s({ id: '1', status: 'APPROVED', submittedAt: undefined }),
        s({ id: '2', status: 'APPROVED', returnedAt: undefined }),
        s({ id: '3', status: 'APPROVED' }),
      ],
    });
    expect(r.closedConsidered).toBe(1);
  });

  it('honors date range on submittedAt', () => {
    const r = buildSubmittalTurnaround({
      start: '2026-04-01',
      end: '2026-04-30',
      submittals: [
        s({ id: 'before', submittedAt: '2026-03-15', returnedAt: '2026-03-20' }),
        s({ id: 'in', submittedAt: '2026-04-15', returnedAt: '2026-04-20' }),
        s({ id: 'after', submittedAt: '2026-05-01', returnedAt: '2026-05-05' }),
      ],
    });
    expect(r.closedConsidered).toBe(1);
  });

  it('groups missing submittedTo as Unknown bucket', () => {
    const r = buildSubmittalTurnaround({
      submittals: [
        s({ id: '1', submittedTo: undefined }),
        s({ id: '2', submittedTo: '' }),
      ],
    });
    expect(r.byReviewer).toHaveLength(1);
    expect(r.byReviewer[0]?.reviewer).toBe('Unknown');
  });

  it('sorts slowest mean first', () => {
    const r = buildSubmittalTurnaround({
      submittals: [
        s({ id: '1', submittedTo: 'fast', submittedAt: '2026-04-01', returnedAt: '2026-04-04' }),
        s({ id: '2', submittedTo: 'slow', submittedAt: '2026-04-01', returnedAt: '2026-05-15' }),
      ],
    });
    expect(r.byReviewer[0]?.reviewer).toBe('slow');
  });

  it('blendedMeanTurnaroundDays averages all closed', () => {
    const r = buildSubmittalTurnaround({
      submittals: [
        s({ id: '1', submittedAt: '2026-04-01', returnedAt: '2026-04-11' }), // 10
        s({ id: '2', submittedAt: '2026-04-01', returnedAt: '2026-04-21' }), // 20
      ],
    });
    expect(r.blendedMeanTurnaroundDays).toBe(15);
  });
});
