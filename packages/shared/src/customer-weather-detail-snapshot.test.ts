import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { WeatherLog } from './weather-log';

import { buildCustomerWeatherDetailSnapshot } from './customer-weather-detail-snapshot';

function jb(id: string, owner: string): Job {
  return {
    id,
    createdAt: '',
    updatedAt: '',
    projectName: 'T',
    projectType: 'BRIDGE',
    contractType: 'PUBLIC_WORKS',
    status: 'PURSUING',
    ownerAgency: owner,
  } as Job;
}

function wx(over: Partial<WeatherLog>): WeatherLog {
  return {
    id: 'wx-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    observedOn: '2026-04-15',
    primaryCondition: 'CLEAR',
    impact: 'NONE',
    lostHours: 0,
    heatProceduresActivated: false,
    highHeatProceduresActivated: false,
    ...over,
  } as WeatherLog;
}

describe('buildCustomerWeatherDetailSnapshot', () => {
  it('returns one row per job sorted by lost hours', () => {
    const r = buildCustomerWeatherDetailSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb('j1', 'Caltrans'), jb('j2', 'Caltrans')],
      weatherLogs: [
        wx({ id: 'a', jobId: 'j1', observedOn: '2026-04-13', impact: 'STOPPED', lostHours: 8, highF: 70 }),
        wx({ id: 'b', jobId: 'j1', observedOn: '2026-04-14', impact: 'PARTIAL', lostHours: 2, highF: 96 }),
        wx({ id: 'c', jobId: 'j2', observedOn: '2026-04-15', impact: 'PARTIAL', lostHours: 1, highF: 82 }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('j1');
    expect(r.rows[0]?.total).toBe(2);
    expect(r.rows[0]?.impactedDays).toBe(2);
    expect(r.rows[0]?.stoppedDays).toBe(1);
    expect(r.rows[0]?.lostHours).toBe(10);
    expect(r.rows[0]?.heatTriggerDays).toBe(1);
    expect(r.rows[0]?.highHeatTriggerDays).toBe(1);
    expect(r.rows[1]?.jobId).toBe('j2');
    expect(r.rows[1]?.heatTriggerDays).toBe(1);
    expect(r.rows[1]?.highHeatTriggerDays).toBe(0);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerWeatherDetailSnapshot({
      customerName: 'X',
      jobs: [],
      weatherLogs: [],
    });
    expect(r.rows.length).toBe(0);
  });
});
