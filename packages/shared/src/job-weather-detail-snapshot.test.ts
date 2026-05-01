import { describe, expect, it } from 'vitest';

import type { WeatherLog } from './weather-log';

import { buildJobWeatherDetailSnapshot } from './job-weather-detail-snapshot';

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

describe('buildJobWeatherDetailSnapshot', () => {
  it('returns one row per impact level sorted by lost hours', () => {
    const r = buildJobWeatherDetailSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      weatherLogs: [
        wx({ id: 'a', jobId: 'j1', impact: 'STOPPED', lostHours: 8, highF: 70 }),
        wx({ id: 'b', jobId: 'j1', impact: 'STOPPED', lostHours: 4, highF: 96 }),
        wx({ id: 'c', jobId: 'j1', impact: 'PARTIAL', lostHours: 2, highF: 82 }),
        wx({ id: 'd', jobId: 'j1', impact: 'NONE', highF: 75 }),
        wx({ id: 'e', jobId: 'j2', impact: 'STOPPED', lostHours: 999 }),
      ],
    });
    expect(r.rows.length).toBe(3);
    expect(r.rows[0]?.impact).toBe('STOPPED');
    expect(r.rows[0]?.total).toBe(2);
    expect(r.rows[0]?.lostHours).toBe(12);
    expect(r.rows[0]?.heatTriggerDays).toBe(1);
    expect(r.rows[0]?.highHeatTriggerDays).toBe(1);
    expect(r.rows[1]?.impact).toBe('PARTIAL');
    expect(r.rows[1]?.lostHours).toBe(2);
    expect(r.rows[1]?.heatTriggerDays).toBe(1);
    expect(r.rows[2]?.impact).toBe('NONE');
  });

  it('handles unknown job', () => {
    const r = buildJobWeatherDetailSnapshot({ jobId: 'X', weatherLogs: [] });
    expect(r.rows.length).toBe(0);
  });
});
