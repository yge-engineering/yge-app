import { describe, expect, it } from 'vitest';

import type { Job } from './job';

import { buildBidPursuitMonthly } from './bid-pursuit-monthly';

function job(over: Partial<Pick<Job, 'id' | 'status' | 'bidDueDate'>>): Pick<
  Job,
  'id' | 'status' | 'bidDueDate'
> {
  return {
    id: 'job-1',
    status: 'PURSUING',
    bidDueDate: '2026-04-15',
    ...over,
  };
}

describe('buildBidPursuitMonthly', () => {
  it('skips jobs without bidDueDate', () => {
    const r = buildBidPursuitMonthly({
      jobs: [job({ bidDueDate: undefined })],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('skips jobs with non-yyyy-mm-dd bidDueDate', () => {
    const r = buildBidPursuitMonthly({
      jobs: [job({ bidDueDate: 'TBD' })],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('groups jobs by year-month', () => {
    const r = buildBidPursuitMonthly({
      jobs: [
        job({ id: 'a', bidDueDate: '2026-04-05' }),
        job({ id: 'b', bidDueDate: '2026-04-25' }),
        job({ id: 'c', bidDueDate: '2026-05-10' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
    const apr = r.rows.find((x) => x.yearMonth === '2026-04');
    const may = r.rows.find((x) => x.yearMonth === '2026-05');
    expect(apr?.jobsPursued).toBe(2);
    expect(may?.jobsPursued).toBe(1);
  });

  it('counts AWARDED + LOST + NO_BID + in-flight separately', () => {
    const r = buildBidPursuitMonthly({
      jobs: [
        job({ id: '1', status: 'AWARDED' }),
        job({ id: '2', status: 'AWARDED' }),
        job({ id: '3', status: 'LOST' }),
        job({ id: '4', status: 'NO_BID' }),
        job({ id: '5', status: 'PURSUING' }),
        job({ id: '6', status: 'BID_SUBMITTED' }),
      ],
    });
    expect(r.rows[0]?.awardedCount).toBe(2);
    expect(r.rows[0]?.lostCount).toBe(1);
    expect(r.rows[0]?.noBidCount).toBe(1);
    expect(r.rows[0]?.inFlightCount).toBe(2);
  });

  it('computes win rate as awarded / (awarded + lost)', () => {
    const r = buildBidPursuitMonthly({
      jobs: [
        job({ id: '1', status: 'AWARDED' }),
        job({ id: '2', status: 'AWARDED' }),
        job({ id: '3', status: 'LOST' }),
        // NO_BID and in-flight excluded from win rate denominator.
        job({ id: '4', status: 'NO_BID' }),
        job({ id: '5', status: 'PURSUING' }),
      ],
    });
    expect(r.rows[0]?.winRate).toBeCloseTo(2 / 3, 4);
  });

  it('null win rate when no awarded + lost in month', () => {
    const r = buildBidPursuitMonthly({
      jobs: [
        job({ id: '1', status: 'PURSUING' }),
        job({ id: '2', status: 'NO_BID' }),
      ],
    });
    expect(r.rows[0]?.winRate).toBe(null);
  });

  it('respects window filter', () => {
    const r = buildBidPursuitMonthly({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      jobs: [
        job({ id: 'old', bidDueDate: '2026-03-15' }),
        job({ id: 'in', bidDueDate: '2026-04-15' }),
        job({ id: 'late', bidDueDate: '2026-05-15' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.yearMonth).toBe('2026-04');
  });

  it('rolls up totals + blended win rate', () => {
    const r = buildBidPursuitMonthly({
      jobs: [
        job({ id: '1', bidDueDate: '2026-04-05', status: 'AWARDED' }),
        job({ id: '2', bidDueDate: '2026-04-15', status: 'LOST' }),
        job({ id: '3', bidDueDate: '2026-05-10', status: 'AWARDED' }),
        job({ id: '4', bidDueDate: '2026-05-15', status: 'AWARDED' }),
      ],
    });
    expect(r.rollup.totalAwarded).toBe(3);
    expect(r.rollup.totalLost).toBe(1);
    expect(r.rollup.blendedWinRate).toBe(0.75);
  });

  it('sorts rows by year-month asc', () => {
    const r = buildBidPursuitMonthly({
      jobs: [
        job({ id: 'late', bidDueDate: '2026-06-15' }),
        job({ id: 'early', bidDueDate: '2026-02-15' }),
      ],
    });
    expect(r.rows[0]?.yearMonth).toBe('2026-02');
    expect(r.rows[1]?.yearMonth).toBe('2026-06');
  });

  it('treats ARCHIVED as pursued but not in any outcome bucket', () => {
    const r = buildBidPursuitMonthly({
      jobs: [job({ status: 'ARCHIVED' })],
    });
    expect(r.rows[0]?.jobsPursued).toBe(1);
    expect(r.rows[0]?.awardedCount).toBe(0);
    expect(r.rows[0]?.lostCount).toBe(0);
    expect(r.rows[0]?.noBidCount).toBe(0);
    expect(r.rows[0]?.inFlightCount).toBe(0);
  });
});
