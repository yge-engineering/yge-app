import { describe, expect, it } from 'vitest';

import type { ChangeOrder } from './change-order';
import type { DailyReport } from './daily-report';
import type { Dispatch } from './dispatch';
import type { Job } from './job';
import type { PunchItem } from './punch-list';
import type { Rfi } from './rfi';

import { buildJobRiskScores } from './job-risk-score';

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

function pi(over: Partial<PunchItem>): PunchItem {
  return {
    id: 'pi-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'job-1',
    identifiedOn: '2026-04-01',
    location: 'Sta. 12+50',
    description: 'cosmetic',
    severity: 'MINOR',
    status: 'OPEN',
    ...over,
  } as PunchItem;
}

function rfi(over: Partial<Rfi>): Rfi {
  return {
    id: 'rfi-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'job-1',
    rfiNumber: '14',
    subject: 'Curb detail',
    question: 'Q?',
    priority: 'MEDIUM',
    status: 'SENT',
    ...over,
  } as Rfi;
}

function co(over: Partial<ChangeOrder>): ChangeOrder {
  return {
    id: 'co-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    jobId: 'job-1',
    changeOrderNumber: 'CO-01',
    subject: 'Subgrade',
    description: '',
    reason: 'OWNER_DIRECTED',
    status: 'AGENCY_REVIEW',
    proposedAt: '2026-01-15',
    lineItems: [],
    totalCostImpactCents: 50_000_00,
    totalScheduleImpactDays: 0,
    ...over,
  } as ChangeOrder;
}

function disp(over: Partial<Dispatch>): Dispatch {
  return {
    id: 'disp-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    jobId: 'job-1',
    scheduledFor: '2026-04-20',
    foremanName: 'Lopez',
    scopeOfWork: 'Grade base',
    status: 'POSTED',
    crew: [],
    equipment: [],
    ...over,
  } as Dispatch;
}

describe('buildJobRiskScores', () => {
  it('returns GREEN for an AWARDED job with no signals', () => {
    const r = buildJobRiskScores({
      asOf: '2026-04-27',
      jobs: [job({})],
      punchItems: [],
      rfis: [],
      changeOrders: [],
      dispatches: [disp({})], // recent dispatch keeps "no dispatch" silent
      dailyReports: [],
    });
    expect(r.rows[0]?.flag).toBe('GREEN');
    expect(r.rows[0]?.riskScore).toBeLessThanOrEqual(15);
  });

  it('skips non-AWARDED jobs', () => {
    const r = buildJobRiskScores({
      asOf: '2026-04-27',
      jobs: [job({ status: 'PROSPECT' })],
      punchItems: [],
      rfis: [],
      changeOrders: [],
      dispatches: [],
      dailyReports: [],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('adds points for open SAFETY punch items', () => {
    const r = buildJobRiskScores({
      asOf: '2026-04-27',
      jobs: [job({})],
      punchItems: [pi({ severity: 'SAFETY' })],
      rfis: [],
      changeOrders: [],
      dispatches: [disp({})],
      dailyReports: [],
    });
    const sc = r.rows[0]?.topDrivers.find((c) => c.name === 'safety punches');
    expect(sc?.points).toBeGreaterThan(0);
  });

  it('adds points for stale open COs (>30 days waiting)', () => {
    const r = buildJobRiskScores({
      asOf: '2026-04-27',
      jobs: [job({})],
      punchItems: [],
      rfis: [],
      changeOrders: [co({ proposedAt: '2026-01-01', status: 'AGENCY_REVIEW' })],
      dispatches: [disp({})],
      dailyReports: [],
    });
    const sc = r.rows[0]?.topDrivers.find((c) => c.name === 'stale open COs');
    expect(sc?.points).toBeGreaterThan(0);
  });

  it('adds points for unanswered RFIs older than 7 days', () => {
    const r = buildJobRiskScores({
      asOf: '2026-04-27',
      jobs: [job({})],
      punchItems: [],
      rfis: [rfi({ updatedAt: '2026-04-15T00:00:00.000Z' })],
      changeOrders: [],
      dispatches: [disp({})],
      dailyReports: [],
    });
    const sc = r.rows[0]?.topDrivers.find((c) => c.name === 'unanswered RFIs');
    expect(sc?.points).toBeGreaterThan(0);
  });

  it('adds points when dispatch dark >14 days', () => {
    const r = buildJobRiskScores({
      asOf: '2026-04-27',
      jobs: [job({})],
      punchItems: [],
      rfis: [],
      changeOrders: [],
      dispatches: [disp({ scheduledFor: '2026-04-01' })], // 26 days ago
      dailyReports: [],
    });
    const sc = r.rows[0]?.topDrivers.find((c) => c.name === 'dispatch dark');
    expect(sc?.points).toBe(15);
  });

  it('adds points for schedule slip past revised completion', () => {
    const r = buildJobRiskScores({
      asOf: '2026-04-27',
      jobs: [job({})],
      punchItems: [],
      rfis: [],
      changeOrders: [],
      dispatches: [disp({})],
      dailyReports: [],
      originalCompletionByJobId: new Map([['job-1', '2026-02-01']]),
    });
    const sc = r.rows[0]?.topDrivers.find((c) => c.name === 'schedule slip');
    expect(sc?.points).toBeGreaterThan(0);
  });

  it('classifies tier from total score', () => {
    // Heavy signals → RED
    const r = buildJobRiskScores({
      asOf: '2026-04-27',
      jobs: [job({})],
      punchItems: [
        pi({ id: 'p-1', severity: 'SAFETY' }),
        pi({ id: 'p-2', severity: 'SAFETY' }),
        pi({ id: 'p-3', severity: 'SAFETY' }),
      ],
      rfis: [
        rfi({ id: 'r-1', updatedAt: '2026-03-01T00:00:00.000Z' }),
        rfi({ id: 'r-2', updatedAt: '2026-03-01T00:00:00.000Z' }),
        rfi({ id: 'r-3', updatedAt: '2026-03-01T00:00:00.000Z' }),
        rfi({ id: 'r-4', updatedAt: '2026-03-01T00:00:00.000Z' }),
      ],
      changeOrders: [
        co({ id: 'co-1', proposedAt: '2026-01-01' }),
        co({ id: 'co-2', proposedAt: '2026-01-01' }),
        co({ id: 'co-3', proposedAt: '2026-01-01' }),
      ],
      dispatches: [disp({ scheduledFor: '2026-04-01' })],
      dailyReports: [],
      originalCompletionByJobId: new Map([['job-1', '2026-02-01']]),
    });
    expect(r.rows[0]?.flag).toBe('RED');
  });

  it('caps total score at 100 when every component fires at max', () => {
    // Component max-out sums to 100 exactly:
    //   safety punches  25  (3+ open SAFETY, capped)
    //   stale open COs  20  (3+ COs >30d, capped)
    //   unanswered RFIs 20  (4+ RFIs >7d, capped)
    //   dispatch dark   15  (last dispatch >14d ago)
    //   schedule slip   15  (>30d past revised)
    //   stale punches    5  (3+ punches >30d, capped — same punches above)
    // = 100. No further capping needed; score should be exactly 100.
    const r = buildJobRiskScores({
      asOf: '2026-04-27',
      jobs: [job({})],
      // identifiedOn well before asOf so they also count as stale punches.
      punchItems: Array.from({ length: 20 }, (_, i) =>
        pi({ id: `pi-${i}`, severity: 'SAFETY', identifiedOn: '2026-01-01' }),
      ),
      rfis: Array.from({ length: 20 }, (_, i) =>
        rfi({ id: `rfi-${i}`, updatedAt: '2026-03-01T00:00:00.000Z' }),
      ),
      changeOrders: Array.from({ length: 20 }, (_, i) =>
        co({ id: `co-${i}`, proposedAt: '2026-01-01' }),
      ),
      // Dispatch dark (>14d) instead of "no dispatch in window".
      dispatches: [disp({ scheduledFor: '2026-04-01' })],
      dailyReports: [],
      originalCompletionByJobId: new Map([['job-1', '2026-02-01']]),
    });
    expect(r.rows[0]?.riskScore).toBe(100);
  });

  it('sorts highest-risk first', () => {
    const r = buildJobRiskScores({
      asOf: '2026-04-27',
      jobs: [
        job({ id: 'job-low' }),
        job({ id: 'job-high' }),
      ],
      punchItems: [pi({ jobId: 'job-high', severity: 'SAFETY' })],
      rfis: [],
      changeOrders: [
        co({ jobId: 'job-high', proposedAt: '2026-01-01' }),
      ],
      dispatches: [
        disp({ jobId: 'job-low' }),
        disp({ id: 'd-h', jobId: 'job-high' }),
      ],
      dailyReports: [],
    });
    expect(r.rows[0]?.jobId).toBe('job-high');
  });
});
