import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { WeatherLog } from './weather-log';

import { buildCustomerWeatherSnapshot } from './customer-weather-snapshot';

function jb(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '',
    updatedAt: '',
    projectName: 'T',
    projectType: 'BRIDGE',
    contractType: 'PUBLIC_WORK_LUMP_SUM',
    status: 'PURSUING',
    ownerAgency: 'Caltrans',
    ...over,
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

describe('buildCustomerWeatherSnapshot', () => {
  it('joins logs to customer via job.ownerAgency', () => {
    const r = buildCustomerWeatherSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb({ id: 'j1' }), jb({ id: 'j2', ownerAgency: 'Other' })],
      weatherLogs: [wx({ id: 'a', jobId: 'j1' }), wx({ id: 'b', jobId: 'j2' })],
    });
    expect(r.totalLogs).toBe(1);
  });

  it('counts impact + lost hours + heat triggers', () => {
    const r = buildCustomerWeatherSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb({ id: 'j1' })],
      weatherLogs: [
        wx({ id: 'a', impact: 'STOPPED', lostHours: 8, highF: 92, heatProceduresActivated: false }),
        wx({ id: 'b', impact: 'PARTIAL', lostHours: 2, highF: 95, heatProceduresActivated: true, highHeatProceduresActivated: false }),
      ],
    });
    expect(r.totalLostHours).toBe(10);
    expect(r.impactedDays).toBe(2);
    expect(r.heatTriggerDays).toBe(2);
    expect(r.highHeatTriggerDays).toBe(1);
    expect(r.heatComplianceGaps).toBeGreaterThan(0);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerWeatherSnapshot({ customerName: 'X', jobs: [], weatherLogs: [] });
    expect(r.totalLogs).toBe(0);
  });
});
