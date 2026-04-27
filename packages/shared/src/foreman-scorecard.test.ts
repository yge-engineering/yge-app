import { describe, expect, it } from 'vitest';

import type { DailyReport } from './daily-report';

import { buildForemanScorecard } from './foreman-scorecard';

function dr(over: Partial<DailyReport>): DailyReport {
  return {
    id: 'dr-2026-04-01-00000001',
    createdAt: '2026-04-01T18:00:00.000Z',
    updatedAt: '2026-04-01T18:00:00.000Z',
    date: '2026-04-01',
    jobId: 'job-1',
    foremanId: 'emp-1',
    weather: 'CLEAR',
    crewOnSite: [],
    photoCount: 0,
    submitted: true,
    ...over,
  } as DailyReport;
}

describe('buildForemanScorecard', () => {
  it('counts submitted vs draft separately', () => {
    const r = buildForemanScorecard({
      dailyReports: [
        dr({ id: 'dr-1', foremanId: 'emp-1', submitted: true }),
        dr({ id: 'dr-2', foremanId: 'emp-1', submitted: false }),
      ],
    });
    expect(r.rows[0]?.drsSubmitted).toBe(1);
    expect(r.rows[0]?.draftCount).toBe(1);
    expect(r.rows[0]?.submissionRate).toBe(0.5);
  });

  it('classifies same-day submission', () => {
    const r = buildForemanScorecard({
      dailyReports: [
        dr({ date: '2026-04-01', updatedAt: '2026-04-01T20:00:00.000Z' }),
      ],
    });
    expect(r.rows[0]?.sameDayCount).toBe(1);
  });

  it('classifies 1-day-late submission', () => {
    const r = buildForemanScorecard({
      dailyReports: [
        dr({ date: '2026-04-01', updatedAt: '2026-04-02T08:00:00.000Z' }),
      ],
    });
    expect(r.rows[0]?.oneDayLateCount).toBe(1);
  });

  it('classifies 2-day and 3+-day late submissions', () => {
    const r = buildForemanScorecard({
      dailyReports: [
        dr({ id: 'dr-1', date: '2026-04-01', updatedAt: '2026-04-03T08:00:00.000Z' }),
        dr({ id: 'dr-2', date: '2026-04-01', updatedAt: '2026-04-05T08:00:00.000Z' }),
      ],
    });
    expect(r.rows[0]?.twoDayLateCount).toBe(1);
    expect(r.rows[0]?.threePlusLateCount).toBe(1);
  });

  it('averages photos across submitted DRs only', () => {
    const r = buildForemanScorecard({
      dailyReports: [
        dr({ id: 'dr-1', photoCount: 10, submitted: true }),
        dr({ id: 'dr-2', photoCount: 6, submitted: true }),
        dr({ id: 'dr-3', photoCount: 100, submitted: false }), // ignored
      ],
    });
    expect(r.rows[0]?.avgPhotos).toBe(8);
    expect(r.rows[0]?.totalPhotos).toBe(16);
  });

  it('averages crew size and worked hours from crewOnSite rows', () => {
    const r = buildForemanScorecard({
      dailyReports: [
        dr({
          id: 'dr-1',
          crewOnSite: [
            { employeeId: 'e1', startTime: '07:00', endTime: '15:30', lunchOut: '11:30', lunchIn: '12:00' },
            { employeeId: 'e2', startTime: '07:00', endTime: '15:30', lunchOut: '11:30', lunchIn: '12:00' },
          ],
        }),
      ],
    });
    expect(r.rows[0]?.avgCrewSize).toBe(2);
    // 8 hours each * 2 = 16 / 1 DR = 16.0
    expect(r.rows[0]?.avgWorkedHours).toBe(16);
  });

  it('counts distinct jobs the foreman ran', () => {
    const r = buildForemanScorecard({
      dailyReports: [
        dr({ id: 'dr-1', jobId: 'job-1' }),
        dr({ id: 'dr-2', jobId: 'job-1' }),
        dr({ id: 'dr-3', jobId: 'job-2' }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('flags lagging foremen (> 25% of submissions are 2+ days late)', () => {
    const r = buildForemanScorecard({
      dailyReports: [
        // foreman A: 4 DRs, 2 are 2+ days late = 50% lagging
        dr({ id: 'a-1', foremanId: 'a', date: '2026-04-01', updatedAt: '2026-04-01T20:00:00Z' }),
        dr({ id: 'a-2', foremanId: 'a', date: '2026-04-02', updatedAt: '2026-04-02T20:00:00Z' }),
        dr({ id: 'a-3', foremanId: 'a', date: '2026-04-03', updatedAt: '2026-04-05T20:00:00Z' }),
        dr({ id: 'a-4', foremanId: 'a', date: '2026-04-04', updatedAt: '2026-04-08T20:00:00Z' }),
        // foreman B: 4 DRs, all same-day
        dr({ id: 'b-1', foremanId: 'b', date: '2026-04-01', updatedAt: '2026-04-01T20:00:00Z' }),
        dr({ id: 'b-2', foremanId: 'b', date: '2026-04-02', updatedAt: '2026-04-02T20:00:00Z' }),
        dr({ id: 'b-3', foremanId: 'b', date: '2026-04-03', updatedAt: '2026-04-03T20:00:00Z' }),
        dr({ id: 'b-4', foremanId: 'b', date: '2026-04-04', updatedAt: '2026-04-04T20:00:00Z' }),
      ],
    });
    expect(r.rollup.laggingForemen).toBe(1);
  });

  it('respects fromDate / toDate range filter', () => {
    const r = buildForemanScorecard({
      fromDate: '2026-04-15',
      toDate: '2026-04-30',
      dailyReports: [
        dr({ id: 'dr-1', date: '2026-04-10' }), // before
        dr({ id: 'dr-2', date: '2026-04-20' }), // in range
        dr({ id: 'dr-3', date: '2026-05-01' }), // after
      ],
    });
    expect(r.rollup.totalDrs).toBe(1);
  });
});
