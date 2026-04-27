import { describe, expect, it } from 'vitest';

import type { DailyReport } from './daily-report';
import type { Job } from './job';

import { buildJobPhotoCoverage } from './job-photo-coverage';

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

function dr(over: Partial<DailyReport>): DailyReport {
  return {
    id: 'dr-1',
    createdAt: '2026-04-01T18:00:00.000Z',
    updatedAt: '2026-04-01T18:00:00.000Z',
    date: '2026-04-01',
    jobId: 'job-1',
    foremanId: 'emp-foreman',
    weather: 'CLEAR',
    crewOnSite: [],
    photoCount: 5,
    submitted: true,
    ...over,
  } as DailyReport;
}

describe('buildJobPhotoCoverage', () => {
  it('flags POOR when no DRs', () => {
    const r = buildJobPhotoCoverage({
      jobs: [job({})],
      dailyReports: [],
    });
    expect(r.rows[0]?.flag).toBe('POOR');
  });

  it('flags STRONG with >=80% coverage and >=3 avg photos', () => {
    const reports: DailyReport[] = [];
    for (let i = 0; i < 10; i += 1) {
      const day = String(i + 1).padStart(2, '0');
      reports.push(dr({ id: `dr-${i}`, date: `2026-04-${day}`, photoCount: 5 }));
    }
    const r = buildJobPhotoCoverage({
      jobs: [job({})],
      dailyReports: reports,
    });
    expect(r.rows[0]?.flag).toBe('STRONG');
  });

  it('flags OK at 50-80% coverage', () => {
    const reports: DailyReport[] = [];
    for (let i = 0; i < 10; i += 1) {
      const day = String(i + 1).padStart(2, '0');
      reports.push(dr({
        id: `dr-${i}`,
        date: `2026-04-${day}`,
        photoCount: i < 6 ? 5 : 0, // 6/10 = 60%
      }));
    }
    const r = buildJobPhotoCoverage({
      jobs: [job({})],
      dailyReports: reports,
    });
    expect(r.rows[0]?.flag).toBe('OK');
  });

  it('flags THIN at 25-50%', () => {
    const reports: DailyReport[] = [];
    for (let i = 0; i < 10; i += 1) {
      const day = String(i + 1).padStart(2, '0');
      reports.push(dr({
        id: `dr-${i}`,
        date: `2026-04-${day}`,
        photoCount: i < 3 ? 5 : 0, // 3/10 = 30%
      }));
    }
    const r = buildJobPhotoCoverage({
      jobs: [job({})],
      dailyReports: reports,
    });
    expect(r.rows[0]?.flag).toBe('THIN');
  });

  it('flags POOR for <25%', () => {
    const reports: DailyReport[] = [];
    for (let i = 0; i < 10; i += 1) {
      const day = String(i + 1).padStart(2, '0');
      reports.push(dr({
        id: `dr-${i}`,
        date: `2026-04-${day}`,
        photoCount: i < 1 ? 5 : 0, // 1/10 = 10%
      }));
    }
    const r = buildJobPhotoCoverage({
      jobs: [job({})],
      dailyReports: reports,
    });
    expect(r.rows[0]?.flag).toBe('POOR');
  });

  it('skips draft DRs', () => {
    const r = buildJobPhotoCoverage({
      jobs: [job({})],
      dailyReports: [
        dr({ submitted: false, photoCount: 99 }),
      ],
    });
    expect(r.rows[0]?.drCount).toBe(0);
  });

  it('respects window bounds', () => {
    const r = buildJobPhotoCoverage({
      fromDate: '2026-04-15',
      toDate: '2026-04-30',
      jobs: [job({})],
      dailyReports: [
        dr({ id: 'old', date: '2026-04-01' }),
        dr({ id: 'in', date: '2026-04-20' }),
      ],
    });
    expect(r.rows[0]?.drCount).toBe(1);
  });

  it('skips non-AWARDED jobs by default', () => {
    const r = buildJobPhotoCoverage({
      jobs: [
        job({ id: 'j-prosp', status: 'PROSPECT' }),
        job({ id: 'j-awd' }),
      ],
      dailyReports: [],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.jobId).toBe('j-awd');
  });

  it('rolls up tier counts and totals', () => {
    const r = buildJobPhotoCoverage({
      jobs: [job({ id: 'j-strong' }), job({ id: 'j-poor' })],
      dailyReports: [
        ...Array.from({ length: 10 }, (_, i) =>
          dr({
            id: `s-${i}`,
            jobId: 'j-strong',
            date: `2026-04-${String(i + 1).padStart(2, '0')}`,
            photoCount: 5,
          }),
        ),
        dr({ id: 'p-1', jobId: 'j-poor', date: '2026-04-01', photoCount: 0 }),
      ],
    });
    expect(r.rollup.strong).toBe(1);
    expect(r.rollup.poor).toBe(1);
    expect(r.rollup.totalPhotos).toBe(50);
  });

  it('sorts POOR first, STRONG last', () => {
    const r = buildJobPhotoCoverage({
      jobs: [job({ id: 'j-strong' }), job({ id: 'j-poor' })],
      dailyReports: [
        ...Array.from({ length: 10 }, (_, i) =>
          dr({
            id: `s-${i}`,
            jobId: 'j-strong',
            date: `2026-04-${String(i + 1).padStart(2, '0')}`,
            photoCount: 5,
          }),
        ),
        dr({ id: 'p-1', jobId: 'j-poor', date: '2026-04-01', photoCount: 0 }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('j-poor');
    expect(r.rows[1]?.jobId).toBe('j-strong');
  });
});
