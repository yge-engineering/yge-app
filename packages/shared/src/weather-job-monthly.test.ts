import { describe, expect, it } from 'vitest';

import type { WeatherLog } from './weather-log';

import { buildWeatherJobMonthly } from './weather-job-monthly';

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

describe('buildWeatherJobMonthly', () => {
  it('groups by (jobId, month)', () => {
    const r = buildWeatherJobMonthly({
      weatherLogs: [
        wx({ id: 'a', jobId: 'j1', observedOn: '2026-04-15' }),
        wx({ id: 'b', jobId: 'j2', observedOn: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('sums lost hours and counts impact days', () => {
    const r = buildWeatherJobMonthly({
      weatherLogs: [
        wx({ id: 'a', impact: 'STOPPED', lostHours: 8 }),
        wx({ id: 'b', impact: 'PARTIAL', lostHours: 4 }),
      ],
    });
    expect(r.rows[0]?.totalLostHours).toBe(12);
    expect(r.rows[0]?.stoppedDays).toBe(1);
    expect(r.rows[0]?.partialImpactDays).toBe(1);
  });

  it('counts heat-activated days', () => {
    const r = buildWeatherJobMonthly({
      weatherLogs: [
        wx({ id: 'a', heatProceduresActivated: true }),
        wx({ id: 'b', heatProceduresActivated: false }),
      ],
    });
    expect(r.rows[0]?.heatActivatedDays).toBe(1);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildWeatherJobMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      weatherLogs: [
        wx({ id: 'mar', observedOn: '2026-03-15' }),
        wx({ id: 'apr', observedOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalEntries).toBe(1);
  });

  it('sorts by jobId asc, month asc', () => {
    const r = buildWeatherJobMonthly({
      weatherLogs: [
        wx({ id: 'a', jobId: 'Z', observedOn: '2026-04-15' }),
        wx({ id: 'b', jobId: 'A', observedOn: '2026-04-15' }),
        wx({ id: 'c', jobId: 'A', observedOn: '2026-03-15' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('A');
    expect(r.rows[0]?.month).toBe('2026-03');
  });

  it('rolls up totals', () => {
    const r = buildWeatherJobMonthly({
      weatherLogs: [
        wx({ id: 'a', lostHours: 5 }),
        wx({ id: 'b', lostHours: 3 }),
      ],
    });
    expect(r.rollup.totalEntries).toBe(2);
    expect(r.rollup.totalLostHours).toBe(8);
  });

  it('handles empty input', () => {
    const r = buildWeatherJobMonthly({ weatherLogs: [] });
    expect(r.rows).toHaveLength(0);
  });
});
