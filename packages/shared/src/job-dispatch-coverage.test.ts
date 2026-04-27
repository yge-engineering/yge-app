import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';
import type { Job } from './job';

import { buildJobDispatchCoverage } from './job-dispatch-coverage';

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

function disp(over: Partial<Dispatch>): Dispatch {
  return {
    id: 'disp-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'job-1',
    scheduledFor: '2026-04-01',
    foremanName: 'Lopez',
    scopeOfWork: 'Grade base',
    status: 'POSTED',
    crew: [],
    equipment: [],
    ...over,
  } as Dispatch;
}

describe('buildJobDispatchCoverage', () => {
  it('flags DARK when no dispatches in window', () => {
    const r = buildJobDispatchCoverage({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      jobs: [job({})],
      dispatches: [],
    });
    expect(r.rows[0]?.flag).toBe('DARK');
    expect(r.rows[0]?.daysDispatched).toBe(0);
    expect(r.rows[0]?.lastDispatchDate).toBe(null);
  });

  it('flags LIGHT for 5-30% coverage', () => {
    // 3 days in 30-day window = 10%
    const dispatches: Dispatch[] = [];
    for (let d = 1; d <= 3; d++) {
      const day = String(d).padStart(2, '0');
      dispatches.push(disp({ id: `d-${d}`, scheduledFor: `2026-04-${day}` }));
    }
    const r = buildJobDispatchCoverage({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      jobs: [job({})],
      dispatches,
    });
    expect(r.rows[0]?.flag).toBe('LIGHT');
  });

  it('flags STEADY for 30-75% coverage', () => {
    // 15 days in 30-day window = 50%
    const dispatches: Dispatch[] = [];
    for (let d = 1; d <= 15; d++) {
      const day = String(d).padStart(2, '0');
      dispatches.push(disp({ id: `d-${d}`, scheduledFor: `2026-04-${day}` }));
    }
    const r = buildJobDispatchCoverage({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      jobs: [job({})],
      dispatches,
    });
    expect(r.rows[0]?.flag).toBe('STEADY');
  });

  it('flags HEAVY for >75% coverage', () => {
    // 25 days in 30-day window = 83%
    const dispatches: Dispatch[] = [];
    for (let d = 1; d <= 25; d++) {
      const day = String(d).padStart(2, '0');
      dispatches.push(disp({ id: `d-${d}`, scheduledFor: `2026-04-${day}` }));
    }
    const r = buildJobDispatchCoverage({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      jobs: [job({})],
      dispatches,
    });
    expect(r.rows[0]?.flag).toBe('HEAVY');
  });

  it('only counts POSTED + COMPLETED by default', () => {
    const r = buildJobDispatchCoverage({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      jobs: [job({})],
      dispatches: [
        disp({ id: 'd-1', status: 'DRAFT', scheduledFor: '2026-04-15' }),
        disp({ id: 'd-2', status: 'CANCELLED', scheduledFor: '2026-04-20' }),
      ],
    });
    expect(r.rows[0]?.daysDispatched).toBe(0);
  });

  it('includes DRAFT when includeDraftDispatches=true', () => {
    const r = buildJobDispatchCoverage({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      includeDraftDispatches: true,
      jobs: [job({})],
      dispatches: [
        disp({ id: 'd-1', status: 'DRAFT', scheduledFor: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.daysDispatched).toBe(1);
  });

  it('captures last dispatch date and days since', () => {
    const r = buildJobDispatchCoverage({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      jobs: [job({})],
      dispatches: [
        disp({ id: 'd-1', scheduledFor: '2026-04-05' }),
        disp({ id: 'd-2', scheduledFor: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.lastDispatchDate).toBe('2026-04-15');
    expect(r.rows[0]?.daysSinceLastDispatch).toBe(15);
  });

  it('skips non-AWARDED jobs by default', () => {
    const r = buildJobDispatchCoverage({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      jobs: [
        job({ id: 'job-prosp', status: 'PROSPECT' }),
        job({ id: 'job-awarded', status: 'AWARDED' }),
      ],
      dispatches: [],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.jobId).toBe('job-awarded');
  });

  it('counts duplicate dispatches per day as one', () => {
    const r = buildJobDispatchCoverage({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      jobs: [job({})],
      dispatches: [
        disp({ id: 'd-1', scheduledFor: '2026-04-15' }),
        disp({ id: 'd-2', scheduledFor: '2026-04-15' }),
        disp({ id: 'd-3', scheduledFor: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.daysDispatched).toBe(1);
  });

  it('sorts DARK first, then LIGHT, STEADY, HEAVY', () => {
    const r = buildJobDispatchCoverage({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      jobs: [
        job({ id: 'job-heavy' }),
        job({ id: 'job-dark' }),
      ],
      dispatches: Array.from({ length: 25 }, (_, i) =>
        disp({
          id: `d-${i}`,
          jobId: 'job-heavy',
          scheduledFor: `2026-04-${String(i + 1).padStart(2, '0')}`,
        }),
      ),
    });
    expect(r.rows[0]?.jobId).toBe('job-dark');
    expect(r.rows[1]?.jobId).toBe('job-heavy');
  });
});
