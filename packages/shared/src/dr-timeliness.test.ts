import { describe, expect, it } from 'vitest';
import { buildDrTimelinessReport } from './dr-timeliness';
import type { DailyReport } from './daily-report';

function dr(over: Partial<DailyReport>): DailyReport {
  return {
    id: 'dr-1',
    createdAt: '2026-04-15T17:00:00Z',
    updatedAt: '2026-04-15T17:00:00Z',
    date: '2026-04-15',
    jobId: 'job-1',
    foremanId: 'emp-bob',
    weather: 'sunny',
    crewOnSite: [],
    photoCount: 0,
    submitted: true,
    ...over,
  } as DailyReport;
}

describe('buildDrTimelinessReport', () => {
  it('SAME_DAY when work-date and createdAt match', () => {
    const r = buildDrTimelinessReport({
      start: '2026-04-01',
      end: '2026-04-30',
      dailyReports: [dr({ date: '2026-04-15', createdAt: '2026-04-15T17:00:00Z' })],
    });
    expect(r.byForeman[0]?.sameDay).toBe(1);
    expect(r.byForeman[0]?.meanLagDays).toBe(0);
  });

  it('NEXT_DAY when filed within 2 days', () => {
    const r = buildDrTimelinessReport({
      start: '2026-04-01',
      end: '2026-04-30',
      dailyReports: [dr({ date: '2026-04-15', createdAt: '2026-04-17T08:00:00Z' })],
    });
    expect(r.byForeman[0]?.nextDay).toBe(1);
  });

  it('LATE when 3-7 days', () => {
    const r = buildDrTimelinessReport({
      start: '2026-04-01',
      end: '2026-04-30',
      dailyReports: [dr({ date: '2026-04-15', createdAt: '2026-04-22T08:00:00Z' })],
    });
    expect(r.byForeman[0]?.late).toBe(1);
  });

  it('STALE when 8+ days', () => {
    const r = buildDrTimelinessReport({
      start: '2026-04-01',
      end: '2026-04-30',
      dailyReports: [dr({ date: '2026-04-01', createdAt: '2026-04-15T08:00:00Z' })],
    });
    expect(r.byForeman[0]?.stale).toBe(1);
    expect(r.byForeman[0]?.maxLagDays).toBe(14);
  });

  it('skips DRAFT reports', () => {
    const r = buildDrTimelinessReport({
      start: '2026-04-01',
      end: '2026-04-30',
      dailyReports: [dr({ submitted: false })],
    });
    expect(r.reportCount).toBe(0);
  });

  it('honors date range on work date', () => {
    const r = buildDrTimelinessReport({
      start: '2026-04-13',
      end: '2026-04-17',
      dailyReports: [
        dr({ id: 'in', date: '2026-04-15' }),
        dr({ id: 'before', date: '2026-04-01' }),
        dr({ id: 'after', date: '2026-04-30' }),
      ],
    });
    expect(r.reportCount).toBe(1);
  });

  it('rolls up per foreman + ranks slowest mean first', () => {
    const r = buildDrTimelinessReport({
      start: '2026-04-01',
      end: '2026-04-30',
      dailyReports: [
        // emp-bob: same-day twice
        dr({ id: '1', foremanId: 'emp-bob', date: '2026-04-13', createdAt: '2026-04-13T17:00:00Z' }),
        dr({ id: '2', foremanId: 'emp-bob', date: '2026-04-14', createdAt: '2026-04-14T17:00:00Z' }),
        // emp-carol: filed 5 days late twice
        dr({ id: '3', foremanId: 'emp-carol', date: '2026-04-15', createdAt: '2026-04-20T08:00:00Z' }),
        dr({ id: '4', foremanId: 'emp-carol', date: '2026-04-16', createdAt: '2026-04-21T08:00:00Z' }),
      ],
    });
    expect(r.byForeman[0]?.foremanId).toBe('emp-carol');
    expect(r.byForeman[0]?.meanLagDays).toBe(5);
    expect(r.byForeman[1]?.foremanId).toBe('emp-bob');
  });

  it('blendedSameDayRate averages across all reports', () => {
    const r = buildDrTimelinessReport({
      start: '2026-04-01',
      end: '2026-04-30',
      dailyReports: [
        dr({ id: '1', date: '2026-04-15', createdAt: '2026-04-15T17:00:00Z' }), // same
        dr({ id: '2', date: '2026-04-15', createdAt: '2026-04-15T17:00:00Z' }), // same
        dr({ id: '3', date: '2026-04-15', createdAt: '2026-04-25T08:00:00Z' }), // stale
      ],
    });
    expect(r.blendedSameDayRate).toBeCloseTo(2 / 3, 4);
  });
});
