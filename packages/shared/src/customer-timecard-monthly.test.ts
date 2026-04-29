import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { TimeCard, TimeEntry } from './time-card';

import { buildCustomerTimecardMonthly } from './customer-timecard-monthly';

function job(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    projectName: 'Test',
    projectType: 'ROAD_RECONSTRUCTION',
    contractType: 'PUBLIC',
    status: 'AWARDED',
    ownerAgency: 'Caltrans D2',
    ...over,
  } as Job;
}

function entry(over: Partial<TimeEntry>): TimeEntry {
  return {
    date: '2026-04-15',
    jobId: 'j1',
    startTime: '07:00',
    endTime: '15:30',
    lunchOut: '11:30',
    lunchIn: '12:00',
    ...over,
  } as TimeEntry;
}

function tc(over: Partial<TimeCard>): TimeCard {
  return {
    id: 'tc-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    employeeId: 'e1',
    weekStarting: '2026-04-13',
    entries: [entry({})],
    status: 'APPROVED',
    ...over,
  } as TimeCard;
}

describe('buildCustomerTimecardMonthly', () => {
  it('groups entries by (customer, month)', () => {
    const r = buildCustomerTimecardMonthly({
      jobs: [
        job({ id: 'j1', ownerAgency: 'Caltrans D2' }),
        job({ id: 'j2', ownerAgency: 'CAL FIRE' }),
      ],
      timecards: [
        tc({
          id: 'a',
          entries: [
            entry({ date: '2026-04-15', jobId: 'j1' }),
            entry({ date: '2026-04-16', jobId: 'j2' }),
            entry({ date: '2026-05-01', jobId: 'j1' }),
          ],
        }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('sums worked hours per (customer, month)', () => {
    const r = buildCustomerTimecardMonthly({
      jobs: [job({ id: 'j1' })],
      timecards: [
        tc({
          id: 'a',
          entries: [
            entry({ startTime: '07:00', endTime: '15:30', lunchOut: '11:30', lunchIn: '12:00' }),
            entry({ startTime: '07:00', endTime: '15:30', lunchOut: '11:30', lunchIn: '12:00' }),
          ],
        }),
      ],
    });
    expect(r.rows[0]?.entries).toBe(2);
    expect(r.rows[0]?.totalHours).toBe(16);
  });

  it('counts distinct employees + jobs', () => {
    const r = buildCustomerTimecardMonthly({
      jobs: [
        job({ id: 'j1', ownerAgency: 'Caltrans D2' }),
        job({ id: 'j2', ownerAgency: 'Caltrans D2' }),
      ],
      timecards: [
        tc({ id: 'a', employeeId: 'e1', entries: [entry({ jobId: 'j1' })] }),
        tc({ id: 'b', employeeId: 'e2', entries: [entry({ jobId: 'j2' })] }),
        tc({ id: 'c', employeeId: 'e1', entries: [entry({ jobId: 'j1' })] }),
      ],
    });
    expect(r.rows[0]?.distinctEmployees).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('counts unattributed (no matching job)', () => {
    const r = buildCustomerTimecardMonthly({
      jobs: [job({ id: 'j1' })],
      timecards: [
        tc({ id: 'a', entries: [entry({ jobId: 'j1' }), entry({ jobId: 'orphan' })] }),
      ],
    });
    expect(r.rollup.unattributed).toBe(1);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildCustomerTimecardMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      jobs: [job({ id: 'j1' })],
      timecards: [
        tc({
          id: 'a',
          entries: [
            entry({ date: '2026-03-15' }),
            entry({ date: '2026-04-15' }),
          ],
        }),
      ],
    });
    expect(r.rollup.totalEntries).toBe(1);
  });

  it('sorts by customerName asc, month asc', () => {
    const r = buildCustomerTimecardMonthly({
      jobs: [
        job({ id: 'jA', ownerAgency: 'A Agency' }),
        job({ id: 'jZ', ownerAgency: 'Z Agency' }),
      ],
      timecards: [
        tc({
          id: 'a',
          entries: [
            entry({ jobId: 'jZ', date: '2026-04-15' }),
            entry({ jobId: 'jA', date: '2026-05-01' }),
            entry({ jobId: 'jA', date: '2026-04-15' }),
          ],
        }),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('A Agency');
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[2]?.customerName).toBe('Z Agency');
  });

  it('handles empty input', () => {
    const r = buildCustomerTimecardMonthly({ jobs: [], timecards: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalEntries).toBe(0);
  });
});
