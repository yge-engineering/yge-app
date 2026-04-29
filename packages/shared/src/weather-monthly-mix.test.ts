import { describe, expect, it } from 'vitest';

import type { WeatherLog } from './weather-log';

import { buildWeatherMonthlyMix } from './weather-monthly-mix';

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

describe('buildWeatherMonthlyMix', () => {
  it('buckets by yyyy-mm of observedOn', () => {
    const r = buildWeatherMonthlyMix({
      weatherLogs: [
        wx({ id: 'a', observedOn: '2026-03-15' }),
        wx({ id: 'b', observedOn: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('breaks down by condition', () => {
    const r = buildWeatherMonthlyMix({
      weatherLogs: [
        wx({ id: 'a', primaryCondition: 'CLEAR' }),
        wx({ id: 'b', primaryCondition: 'HEAVY_RAIN' }),
        wx({ id: 'c', primaryCondition: 'HEAVY_RAIN' }),
      ],
    });
    expect(r.rows[0]?.byCondition.CLEAR).toBe(1);
    expect(r.rows[0]?.byCondition.HEAVY_RAIN).toBe(2);
  });

  it('sums lost hours', () => {
    const r = buildWeatherMonthlyMix({
      weatherLogs: [
        wx({ id: 'a', lostHours: 4 }),
        wx({ id: 'b', lostHours: 3.5 }),
      ],
    });
    expect(r.rows[0]?.totalLostHours).toBe(7.5);
  });

  it('counts stopped vs partial impact days', () => {
    const r = buildWeatherMonthlyMix({
      weatherLogs: [
        wx({ id: 'stopped1', impact: 'STOPPED' }),
        wx({ id: 'stopped2', impact: 'STOPPED' }),
        wx({ id: 'partial', impact: 'PARTIAL' }),
        wx({ id: 'none', impact: 'NONE' }),
      ],
    });
    expect(r.rows[0]?.stoppedDays).toBe(2);
    expect(r.rows[0]?.partialImpactDays).toBe(1);
  });

  it('counts heat-activated days', () => {
    const r = buildWeatherMonthlyMix({
      weatherLogs: [
        wx({ id: 'a', heatProceduresActivated: true }),
        wx({ id: 'b', heatProceduresActivated: false }),
      ],
    });
    expect(r.rows[0]?.heatActivatedDays).toBe(1);
  });

  it('counts distinct jobs', () => {
    const r = buildWeatherMonthlyMix({
      weatherLogs: [
        wx({ id: 'a', jobId: 'j1' }),
        wx({ id: 'b', jobId: 'j2' }),
        wx({ id: 'c', jobId: 'j1' }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('respects fromMonth / toMonth bounds', () => {
    const r = buildWeatherMonthlyMix({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      weatherLogs: [
        wx({ id: 'mar', observedOn: '2026-03-15' }),
        wx({ id: 'apr', observedOn: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sorts by month asc', () => {
    const r = buildWeatherMonthlyMix({
      weatherLogs: [
        wx({ id: 'late', observedOn: '2026-04-15' }),
        wx({ id: 'early', observedOn: '2026-02-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-02');
  });

  it('handles empty input', () => {
    const r = buildWeatherMonthlyMix({ weatherLogs: [] });
    expect(r.rows).toHaveLength(0);
  });
});
