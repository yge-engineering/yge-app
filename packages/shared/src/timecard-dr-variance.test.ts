import { describe, expect, it } from 'vitest';

import type { DailyReport } from './daily-report';
import type { TimeCard } from './time-card';

import { buildTimecardDrVariance } from './timecard-dr-variance';

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
    photoCount: 0,
    submitted: true,
    ...over,
  } as DailyReport;
}

function tc(over: Partial<TimeCard>): TimeCard {
  return {
    id: 'tc-1',
    createdAt: '2026-04-01T18:00:00.000Z',
    updatedAt: '2026-04-01T18:00:00.000Z',
    employeeId: 'emp-1',
    weekStarting: '2026-03-30',
    entries: [],
    status: 'SUBMITTED',
    ...over,
  } as TimeCard;
}

describe('buildTimecardDrVariance', () => {
  it('flags MATCH when DR and TC are within tolerance', () => {
    const r = buildTimecardDrVariance({
      dailyReports: [
        dr({
          crewOnSite: [
            { employeeId: 'emp-1', startTime: '07:00', endTime: '15:30', lunchOut: '11:30', lunchIn: '12:00' },
          ],
        }),
      ],
      timeCards: [
        tc({
          entries: [
            { date: '2026-04-01', jobId: 'job-1', startTime: '07:00', endTime: '15:30', lunchOut: '11:30', lunchIn: '12:00' },
          ],
        }),
      ],
    });
    expect(r.rows[0]?.flag).toBe('MATCH');
    expect(r.rollup.matched).toBe(1);
  });

  it('flags TC_HIGHER when time card claims more', () => {
    const r = buildTimecardDrVariance({
      dailyReports: [
        dr({
          crewOnSite: [
            { employeeId: 'emp-1', startTime: '07:00', endTime: '15:00' }, // 8h
          ],
        }),
      ],
      timeCards: [
        tc({
          entries: [
            { date: '2026-04-01', jobId: 'job-1', startTime: '07:00', endTime: '17:00' }, // 10h
          ],
        }),
      ],
    });
    expect(r.rows[0]?.flag).toBe('TC_HIGHER');
    expect(r.rows[0]?.deltaHours).toBe(2);
    expect(r.rollup.tcHigher).toBe(1);
  });

  it('flags DR_HIGHER when DR claims more', () => {
    const r = buildTimecardDrVariance({
      dailyReports: [
        dr({
          crewOnSite: [
            { employeeId: 'emp-1', startTime: '06:00', endTime: '17:00' }, // 11h
          ],
        }),
      ],
      timeCards: [
        tc({
          entries: [
            { date: '2026-04-01', jobId: 'job-1', startTime: '07:00', endTime: '15:00' }, // 8h
          ],
        }),
      ],
    });
    expect(r.rows[0]?.flag).toBe('DR_HIGHER');
    expect(r.rollup.drHigher).toBe(1);
  });

  it('flags MISSING_DR when time card has hours but no matching DR row', () => {
    const r = buildTimecardDrVariance({
      dailyReports: [],
      timeCards: [
        tc({
          entries: [
            { date: '2026-04-01', jobId: 'job-1', startTime: '07:00', endTime: '15:00' },
          ],
        }),
      ],
    });
    expect(r.rows[0]?.flag).toBe('MISSING_DR');
    expect(r.rollup.missingDr).toBe(1);
  });

  it('flags MISSING_TC when DR has crew row but no time card entry', () => {
    const r = buildTimecardDrVariance({
      dailyReports: [
        dr({
          crewOnSite: [
            { employeeId: 'emp-1', startTime: '07:00', endTime: '15:00' },
          ],
        }),
      ],
      timeCards: [],
    });
    expect(r.rows[0]?.flag).toBe('MISSING_TC');
    expect(r.rollup.missingTc).toBe(1);
  });

  it('skips draft DRs and DRAFT/REJECTED time cards', () => {
    const r = buildTimecardDrVariance({
      dailyReports: [
        dr({
          submitted: false,
          crewOnSite: [
            { employeeId: 'emp-1', startTime: '07:00', endTime: '15:00' },
          ],
        }),
      ],
      timeCards: [
        tc({
          status: 'DRAFT',
          entries: [
            { date: '2026-04-01', jobId: 'job-1', startTime: '07:00', endTime: '15:00' },
          ],
        }),
      ],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('respects fromDate / toDate range filter', () => {
    const r = buildTimecardDrVariance({
      fromDate: '2026-04-15',
      toDate: '2026-04-30',
      dailyReports: [
        dr({
          id: 'dr-early',
          date: '2026-04-10',
          crewOnSite: [
            { employeeId: 'emp-1', startTime: '07:00', endTime: '15:00' },
          ],
        }),
      ],
      timeCards: [
        tc({
          entries: [
            { date: '2026-04-10', jobId: 'job-1', startTime: '07:00', endTime: '15:00' },
          ],
        }),
      ],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('sums multi-entry days into one comparison row', () => {
    const r = buildTimecardDrVariance({
      dailyReports: [
        dr({
          crewOnSite: [
            { employeeId: 'emp-1', startTime: '07:00', endTime: '15:00' }, // 8h
          ],
        }),
      ],
      timeCards: [
        tc({
          entries: [
            // split across two halves of the day, same job
            { date: '2026-04-01', jobId: 'job-1', startTime: '07:00', endTime: '11:00' }, // 4h
            { date: '2026-04-01', jobId: 'job-1', startTime: '11:30', endTime: '15:30' }, // 4h
          ],
        }),
      ],
    });
    expect(r.rows[0]?.tcHours).toBe(8);
    expect(r.rows[0]?.flag).toBe('MATCH');
  });

  it('sorts by absolute variance desc', () => {
    const r = buildTimecardDrVariance({
      dailyReports: [
        dr({
          id: 'dr-a',
          date: '2026-04-01',
          jobId: 'job-1',
          crewOnSite: [
            { employeeId: 'emp-1', startTime: '07:00', endTime: '15:00' }, // 8h
          ],
        }),
        dr({
          id: 'dr-b',
          date: '2026-04-02',
          jobId: 'job-2',
          crewOnSite: [
            { employeeId: 'emp-1', startTime: '07:00', endTime: '15:00' }, // 8h
          ],
        }),
      ],
      timeCards: [
        tc({
          employeeId: 'emp-1',
          entries: [
            // tiny variance on day 1
            { date: '2026-04-01', jobId: 'job-1', startTime: '07:00', endTime: '15:30' }, // 8.5h
            // big variance on day 2
            { date: '2026-04-02', jobId: 'job-2', startTime: '06:00', endTime: '17:00' }, // 11h
          ],
        }),
      ],
    });
    expect(r.rows[0]?.date).toBe('2026-04-02');
  });
});
