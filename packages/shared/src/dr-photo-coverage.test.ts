import { describe, expect, it } from 'vitest';
import { buildDrPhotoCoverageReport } from './dr-photo-coverage';
import type { DailyReport } from './daily-report';

function dr(over: Partial<DailyReport>): DailyReport {
  return {
    id: 'dr-1',
    createdAt: '',
    updatedAt: '',
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

describe('buildDrPhotoCoverageReport', () => {
  it('counts reports with at least one photo', () => {
    const r = buildDrPhotoCoverageReport({
      start: '2026-04-01',
      end: '2026-04-30',
      dailyReports: [
        dr({ id: 'a', photoCount: 3 }),
        dr({ id: 'b', photoCount: 0 }),
        dr({ id: 'c', photoCount: 1 }),
      ],
    });
    expect(r.reportCount).toBe(3);
    expect(r.reportsWithPhotos).toBe(2);
    expect(r.totalPhotos).toBe(4);
    expect(r.blendedCoverageRate).toBeCloseTo(2 / 3, 4);
  });

  it('skips DRAFT reports', () => {
    const r = buildDrPhotoCoverageReport({
      start: '2026-04-01',
      end: '2026-04-30',
      dailyReports: [
        dr({ id: 'a', submitted: false, photoCount: 5 }),
        dr({ id: 'b', submitted: true, photoCount: 0 }),
      ],
    });
    expect(r.reportCount).toBe(1);
  });

  it('honors date range', () => {
    const r = buildDrPhotoCoverageReport({
      start: '2026-04-13',
      end: '2026-04-17',
      dailyReports: [
        dr({ id: 'in', date: '2026-04-15', photoCount: 1 }),
        dr({ id: 'before', date: '2026-04-01', photoCount: 1 }),
        dr({ id: 'after', date: '2026-04-30', photoCount: 1 }),
      ],
    });
    expect(r.reportCount).toBe(1);
  });

  it('per-foreman ranks worst coverage first', () => {
    const r = buildDrPhotoCoverageReport({
      start: '2026-04-01',
      end: '2026-04-30',
      dailyReports: [
        // Bob: 2 of 2 with photos → 100%
        dr({ id: '1', foremanId: 'emp-bob', date: '2026-04-13', photoCount: 1 }),
        dr({ id: '2', foremanId: 'emp-bob', date: '2026-04-14', photoCount: 1 }),
        // Carol: 0 of 3 → 0%
        dr({ id: '3', foremanId: 'emp-carol', date: '2026-04-13', photoCount: 0 }),
        dr({ id: '4', foremanId: 'emp-carol', date: '2026-04-14', photoCount: 0 }),
        dr({ id: '5', foremanId: 'emp-carol', date: '2026-04-15', photoCount: 0 }),
      ],
    });
    expect(r.byForeman[0]?.foremanId).toBe('emp-carol');
    expect(r.byForeman[0]?.coverageRate).toBe(0);
    expect(r.byForeman[1]?.foremanId).toBe('emp-bob');
    expect(r.byForeman[1]?.coverageRate).toBe(1);
  });

  it('averagePhotosPerReport averages across all reports (including zeros)', () => {
    const r = buildDrPhotoCoverageReport({
      start: '2026-04-01',
      end: '2026-04-30',
      dailyReports: [
        dr({ id: '1', foremanId: 'f', photoCount: 6 }),
        dr({ id: '2', foremanId: 'f', photoCount: 0 }),
        dr({ id: '3', foremanId: 'f', photoCount: 0 }),
      ],
    });
    expect(r.byForeman[0]?.averagePhotosPerReport).toBe(2);
  });

  it('per-job rolls up across foremen', () => {
    const r = buildDrPhotoCoverageReport({
      start: '2026-04-01',
      end: '2026-04-30',
      dailyReports: [
        dr({ id: '1', jobId: 'job-A', date: '2026-04-13', photoCount: 1 }),
        dr({ id: '2', jobId: 'job-A', date: '2026-04-14', photoCount: 0 }),
        dr({ id: '3', jobId: 'job-B', date: '2026-04-13', photoCount: 2 }),
      ],
    });
    const a = r.byJob.find((x) => x.jobId === 'job-A')!;
    expect(a.coverageRate).toBeCloseTo(0.5, 4);
    const b = r.byJob.find((x) => x.jobId === 'job-B')!;
    expect(b.coverageRate).toBe(1);
  });
});
