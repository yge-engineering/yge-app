import { describe, expect, it } from 'vitest';

import type { WeatherLog } from './weather-log';

import { buildPortfolioWeatherSnapshot } from './portfolio-weather-snapshot';

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

describe('buildPortfolioWeatherSnapshot', () => {
  it('counts total + ytd', () => {
    const r = buildPortfolioWeatherSnapshot({
      asOf: '2026-04-30',
      logYear: 2026,
      weatherLogs: [
        wx({ id: 'a', observedOn: '2025-04-15' }),
        wx({ id: 'b', observedOn: '2026-04-15' }),
      ],
    });
    expect(r.totalLogs).toBe(2);
    expect(r.ytdLogs).toBe(1);
  });

  it('breaks down by condition + impact', () => {
    const r = buildPortfolioWeatherSnapshot({
      asOf: '2026-04-30',
      weatherLogs: [
        wx({ id: 'a', primaryCondition: 'HEAVY_RAIN', impact: 'STOPPED' }),
        wx({ id: 'b', primaryCondition: 'HEAVY_RAIN', impact: 'PARTIAL' }),
        wx({ id: 'c', primaryCondition: 'CLEAR', impact: 'NONE' }),
      ],
    });
    expect(r.byCondition.HEAVY_RAIN).toBe(2);
    expect(r.byCondition.CLEAR).toBe(1);
    expect(r.byImpact.STOPPED).toBe(1);
    expect(r.byImpact.PARTIAL).toBe(1);
    expect(r.impactedDays).toBe(2);
  });

  it('sums lost hours + counts heat trigger days', () => {
    const r = buildPortfolioWeatherSnapshot({
      asOf: '2026-04-30',
      weatherLogs: [
        wx({ id: 'a', lostHours: 4, highF: 92, heatProceduresActivated: false }),
        wx({ id: 'b', lostHours: 2, highF: 96, heatProceduresActivated: true, highHeatProceduresActivated: false }),
      ],
    });
    expect(r.totalLostHours).toBe(6);
    expect(r.heatTriggerDays).toBe(2);
    expect(r.highHeatTriggerDays).toBe(1);
    expect(r.heatComplianceGaps).toBeGreaterThan(0);
  });

  it('counts distinct jobs', () => {
    const r = buildPortfolioWeatherSnapshot({
      asOf: '2026-04-30',
      weatherLogs: [
        wx({ id: 'a', jobId: 'j1' }),
        wx({ id: 'b', jobId: 'j2' }),
      ],
    });
    expect(r.distinctJobs).toBe(2);
  });

  it('ignores logs after asOf', () => {
    const r = buildPortfolioWeatherSnapshot({
      asOf: '2026-04-30',
      weatherLogs: [wx({ id: 'late', observedOn: '2026-05-15' })],
    });
    expect(r.totalLogs).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioWeatherSnapshot({ weatherLogs: [] });
    expect(r.totalLogs).toBe(0);
  });
});
