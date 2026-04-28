import { describe, expect, it } from 'vitest';

import type { DailyReport } from './daily-report';
import type { Job } from './job';

import { buildJobForemanAssignment } from './job-foreman-assignment';

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

function dr(over: Partial<DailyReport>): DailyReport {
  return {
    id: 'dr-1',
    createdAt: '2026-04-15T17:00:00.000Z',
    updatedAt: '2026-04-15T17:00:00.000Z',
    date: '2026-04-15',
    jobId: 'j1',
    foremanId: 'fm1',
    crewOnSite: [],
    photoCount: 0,
    submitted: true,
    ...over,
  } as DailyReport;
}

describe('buildJobForemanAssignment', () => {
  it('identifies primary foreman + share', () => {
    const r = buildJobForemanAssignment({
      jobs: [job({})],
      reports: [
        dr({ id: 'a', foremanId: 'fm1' }),
        dr({ id: 'b', foremanId: 'fm1' }),
        dr({ id: 'c', foremanId: 'fm1' }),
        dr({ id: 'd', foremanId: 'fm2' }),
      ],
    });
    expect(r.rows[0]?.primaryForemanId).toBe('fm1');
    expect(r.rows[0]?.primaryShare).toBe(0.75);
    expect(r.rows[0]?.distinctForemen).toBe(2);
  });

  it('lists secondary foremen sorted by count desc', () => {
    const r = buildJobForemanAssignment({
      jobs: [job({})],
      reports: [
        dr({ id: 'a', foremanId: 'fm1' }),
        dr({ id: 'b', foremanId: 'fm1' }),
        dr({ id: 'c', foremanId: 'fm2' }),
        dr({ id: 'd', foremanId: 'fm3' }),
        dr({ id: 'e', foremanId: 'fm3' }),
      ],
    });
    const foremen = r.rows[0]?.foremen ?? [];
    expect(foremen[0]?.foremanId).toBe('fm1');
    expect(foremen[1]?.foremanId).toBe('fm3');
    expect(foremen[2]?.foremanId).toBe('fm2');
  });

  it('flags rotating leadership when primary share below threshold', () => {
    const r = buildJobForemanAssignment({
      rotatingThreshold: 0.6,
      jobs: [job({})],
      reports: [
        dr({ id: 'a', foremanId: 'fm1' }),
        dr({ id: 'b', foremanId: 'fm2' }),
        dr({ id: 'c', foremanId: 'fm3' }),
      ],
    });
    expect(r.rollup.jobsWithRotatingLeadership).toBe(1);
  });

  it('does not flag rotating when primary share clears threshold', () => {
    const r = buildJobForemanAssignment({
      rotatingThreshold: 0.6,
      jobs: [job({})],
      reports: [
        dr({ id: 'a', foremanId: 'fm1' }),
        dr({ id: 'b', foremanId: 'fm1' }),
        dr({ id: 'c', foremanId: 'fm1' }),
        dr({ id: 'd', foremanId: 'fm2' }),
      ],
    });
    expect(r.rollup.jobsWithRotatingLeadership).toBe(0);
  });

  it('skips draft DRs', () => {
    const r = buildJobForemanAssignment({
      jobs: [job({})],
      reports: [
        dr({ id: 'd', submitted: false, foremanId: 'fm1' }),
        dr({ id: 's', submitted: true, foremanId: 'fm1' }),
      ],
    });
    expect(r.rows[0]?.totalDrs).toBe(1);
  });

  it('AWARDED-only by default', () => {
    const r = buildJobForemanAssignment({
      jobs: [
        job({ id: 'p', status: 'PROSPECT' }),
        job({ id: 'a' }),
      ],
      reports: [],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('respects from/to date window', () => {
    const r = buildJobForemanAssignment({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      jobs: [job({})],
      reports: [
        dr({ id: 'old', date: '2026-03-15', foremanId: 'fm1' }),
        dr({ id: 'in', date: '2026-04-15', foremanId: 'fm1' }),
      ],
    });
    expect(r.rows[0]?.totalDrs).toBe(1);
  });

  it('sorts jobs by total DRs desc', () => {
    const r = buildJobForemanAssignment({
      jobs: [
        job({ id: 'small' }),
        job({ id: 'big' }),
      ],
      reports: [
        dr({ id: 's', jobId: 'small', foremanId: 'fm1' }),
        dr({ id: 'b1', jobId: 'big', foremanId: 'fm1' }),
        dr({ id: 'b2', jobId: 'big', foremanId: 'fm1' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('big');
  });

  it('returns null primaryForemanId when no DRs', () => {
    const r = buildJobForemanAssignment({
      jobs: [job({})],
      reports: [],
    });
    expect(r.rows[0]?.primaryForemanId).toBe(null);
    expect(r.rows[0]?.primaryShare).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildJobForemanAssignment({ jobs: [], reports: [] });
    expect(r.rows).toHaveLength(0);
  });
});
