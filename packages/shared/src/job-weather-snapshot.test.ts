import { describe, expect, it } from 'vitest';

import type { WeatherLog } from './weather-log';

import { buildJobWeatherSnapshot } from './job-weather-snapshot';

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

describe('buildJobWeatherSnapshot', () => {
  it('filters to one job', () => {
    const r = buildJobWeatherSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      weatherLogs: [
        wx({ id: 'a', jobId: 'j1' }),
        wx({ id: 'b', jobId: 'j2' }),
      ],
    });
    expect(r.totalLogs).toBe(1);
  });

  it('counts impact + lost hours', () => {
    const r = buildJobWeatherSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      weatherLogs: [
        wx({ id: 'a', impact: 'STOPPED', lostHours: 8 }),
        wx({ id: 'b', impact: 'PARTIAL', lostHours: 2 }),
        wx({ id: 'c', impact: 'NONE' }),
      ],
    });
    expect(r.impactedDays).toBe(2);
    expect(r.totalLostHours).toBe(10);
  });

  it('counts heat trigger + compliance gaps', () => {
    const r = buildJobWeatherSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      weatherLogs: [
        wx({ id: 'a', highF: 92, heatProceduresActivated: false }),
        wx({ id: 'b', highF: 96, heatProceduresActivated: true, highHeatProceduresActivated: false }),
      ],
    });
    expect(r.heatTriggerDays).toBe(2);
    expect(r.highHeatTriggerDays).toBe(1);
    expect(r.heatComplianceGaps).toBeGreaterThan(0);
  });

  it('tracks last log date', () => {
    const r = buildJobWeatherSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      weatherLogs: [
        wx({ id: 'a', observedOn: '2026-04-08' }),
        wx({ id: 'b', observedOn: '2026-04-22' }),
      ],
    });
    expect(r.lastLogDate).toBe('2026-04-22');
  });

  it('handles no matching logs', () => {
    const r = buildJobWeatherSnapshot({ jobId: 'j1', weatherLogs: [] });
    expect(r.totalLogs).toBe(0);
    expect(r.lastLogDate).toBeNull();
  });
});
