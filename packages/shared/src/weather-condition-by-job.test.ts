import { describe, expect, it } from 'vitest';

import type { WeatherLog } from './weather-log';

import { buildWeatherConditionByJob } from './weather-condition-by-job';

function wx(over: Partial<WeatherLog>): WeatherLog {
  return {
    id: 'wx-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
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

describe('buildWeatherConditionByJob', () => {
  it('groups by (jobId, condition)', () => {
    const r = buildWeatherConditionByJob({
      weatherLogs: [
        wx({ id: 'a', jobId: 'j1', primaryCondition: 'CLEAR' }),
        wx({ id: 'b', jobId: 'j1', primaryCondition: 'HEAVY_RAIN' }),
        wx({ id: 'c', jobId: 'j2', primaryCondition: 'CLEAR' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('sums lost hours per pair', () => {
    const r = buildWeatherConditionByJob({
      weatherLogs: [
        wx({ id: 'a', primaryCondition: 'HEAVY_RAIN', lostHours: 4 }),
        wx({ id: 'b', primaryCondition: 'HEAVY_RAIN', lostHours: 6 }),
      ],
    });
    expect(r.rows[0]?.totalLostHours).toBe(10);
    expect(r.rows[0]?.observations).toBe(2);
  });

  it('counts impact days', () => {
    const r = buildWeatherConditionByJob({
      weatherLogs: [
        wx({ id: 'a', impact: 'STOPPED' }),
        wx({ id: 'b', impact: 'PARTIAL' }),
      ],
    });
    expect(r.rows[0]?.stoppedDays).toBe(1);
    expect(r.rows[0]?.partialImpactDays).toBe(1);
  });

  it('respects fromDate / toDate window', () => {
    const r = buildWeatherConditionByJob({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      weatherLogs: [
        wx({ id: 'old', observedOn: '2026-03-15' }),
        wx({ id: 'in', observedOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalEntries).toBe(1);
  });

  it('sorts by jobId asc, lostHours desc within job', () => {
    const r = buildWeatherConditionByJob({
      weatherLogs: [
        wx({ id: 'a', jobId: 'A', primaryCondition: 'CLEAR', lostHours: 0 }),
        wx({ id: 'b', jobId: 'A', primaryCondition: 'HEAVY_RAIN', lostHours: 8 }),
      ],
    });
    expect(r.rows[0]?.condition).toBe('HEAVY_RAIN');
  });

  it('handles empty input', () => {
    const r = buildWeatherConditionByJob({ weatherLogs: [] });
    expect(r.rows).toHaveLength(0);
  });
});
