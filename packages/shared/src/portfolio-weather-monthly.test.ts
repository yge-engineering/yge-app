import { describe, expect, it } from 'vitest';

import type { WeatherLog } from './weather-log';

import { buildPortfolioWeatherMonthly } from './portfolio-weather-monthly';

function w(over: Partial<WeatherLog>): WeatherLog {
  return {
    id: 'w-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    observedOn: '2026-04-15',
    primaryCondition: 'HEAVY_RAIN',
    impact: 'STOPPED',
    lostHours: 4,
    ...over,
  } as WeatherLog;
}

describe('buildPortfolioWeatherMonthly', () => {
  it('breaks down by condition + impact', () => {
    const r = buildPortfolioWeatherMonthly({
      weatherLogs: [
        w({ id: 'a', primaryCondition: 'HEAVY_RAIN', impact: 'STOPPED' }),
        w({ id: 'b', primaryCondition: 'WIND', impact: 'PARTIAL' }),
        w({ id: 'c', primaryCondition: 'HEAVY_RAIN', impact: 'STOPPED' }),
      ],
    });
    expect(r.rows[0]?.byCondition.HEAVY_RAIN).toBe(2);
    expect(r.rows[0]?.byCondition.WIND).toBe(1);
    expect(r.rows[0]?.byImpact.STOPPED).toBe(2);
    expect(r.rows[0]?.byImpact.PARTIAL).toBe(1);
  });

  it('sums total lost hours', () => {
    const r = buildPortfolioWeatherMonthly({
      weatherLogs: [
        w({ id: 'a', lostHours: 4 }),
        w({ id: 'b', lostHours: 2 }),
      ],
    });
    expect(r.rows[0]?.totalLostHours).toBe(6);
  });

  it('counts distinct jobs', () => {
    const r = buildPortfolioWeatherMonthly({
      weatherLogs: [
        w({ id: 'a', jobId: 'j1' }),
        w({ id: 'b', jobId: 'j2' }),
        w({ id: 'c', jobId: 'j1' }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildPortfolioWeatherMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      weatherLogs: [
        w({ id: 'old', observedOn: '2026-03-15' }),
        w({ id: 'in', observedOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalEntries).toBe(1);
  });

  it('sorts by month asc', () => {
    const r = buildPortfolioWeatherMonthly({
      weatherLogs: [
        w({ id: 'a', observedOn: '2026-06-15' }),
        w({ id: 'b', observedOn: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[1]?.month).toBe('2026-06');
  });

  it('handles empty input', () => {
    const r = buildPortfolioWeatherMonthly({ weatherLogs: [] });
    expect(r.rows).toHaveLength(0);
  });
});
