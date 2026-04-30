import { describe, expect, it } from 'vitest';

import type { WeatherLog } from './weather-log';

import { buildPortfolioWeatherYoy } from './portfolio-weather-yoy';

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

describe('buildPortfolioWeatherYoy', () => {
  it('compares prior vs current totals + lost hours', () => {
    const r = buildPortfolioWeatherYoy({
      currentYear: 2026,
      weatherLogs: [
        w({ id: 'a', observedOn: '2025-04-15', lostHours: 4 }),
        w({ id: 'b', observedOn: '2026-04-15', lostHours: 8 }),
      ],
    });
    expect(r.priorTotalLostHours).toBe(4);
    expect(r.currentTotalLostHours).toBe(8);
    expect(r.totalLostHoursDelta).toBe(4);
  });

  it('breaks down by condition + impact per year', () => {
    const r = buildPortfolioWeatherYoy({
      currentYear: 2026,
      weatherLogs: [
        w({ id: 'a', observedOn: '2026-04-15', primaryCondition: 'HEAVY_RAIN', impact: 'STOPPED' }),
        w({ id: 'b', observedOn: '2026-04-16', primaryCondition: 'WIND', impact: 'PARTIAL' }),
      ],
    });
    expect(r.currentByCondition.HEAVY_RAIN).toBe(1);
    expect(r.currentByCondition.WIND).toBe(1);
    expect(r.currentByImpact.STOPPED).toBe(1);
    expect(r.currentByImpact.PARTIAL).toBe(1);
  });

  it('counts distinct jobs', () => {
    const r = buildPortfolioWeatherYoy({
      currentYear: 2026,
      weatherLogs: [
        w({ id: 'a', jobId: 'j1' }),
        w({ id: 'b', jobId: 'j2' }),
      ],
    });
    expect(r.currentDistinctJobs).toBe(2);
  });

  it('handles empty input', () => {
    const r = buildPortfolioWeatherYoy({ currentYear: 2026, weatherLogs: [] });
    expect(r.currentTotal).toBe(0);
  });
});
