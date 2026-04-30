import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { WeatherLog } from './weather-log';

import { buildCustomerWeatherYoy } from './customer-weather-yoy';

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

describe('buildCustomerWeatherYoy', () => {
  it('compares two years for one customer', () => {
    const r = buildCustomerWeatherYoy({
      customerName: 'Caltrans',
      currentYear: 2026,
      jobs: [jb('j1', 'Caltrans')],
      weatherLogs: [
        wx({ id: 'a', observedOn: '2025-04-15', lostHours: 4, impact: 'PARTIAL' }),
        wx({ id: 'b', observedOn: '2026-04-15', lostHours: 8, impact: 'STOPPED' }),
      ],
    });
    expect(r.priorTotal).toBe(1);
    expect(r.currentTotal).toBe(1);
    expect(r.priorLostHours).toBe(4);
    expect(r.currentLostHours).toBe(8);
    expect(r.lostHoursDelta).toBe(4);
  });

  it('counts heat triggers + compliance gaps', () => {
    const r = buildCustomerWeatherYoy({
      customerName: 'Caltrans',
      currentYear: 2026,
      jobs: [jb('j1', 'Caltrans')],
      weatherLogs: [
        wx({ id: 'a', observedOn: '2026-04-15', highF: 92, heatProceduresActivated: false }),
      ],
    });
    expect(r.currentHeatTriggerDays).toBe(1);
    expect(r.currentHeatComplianceGaps).toBeGreaterThan(0);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerWeatherYoy({
      customerName: 'X',
      currentYear: 2026,
      jobs: [],
      weatherLogs: [],
    });
    expect(r.priorTotal).toBe(0);
  });
});
