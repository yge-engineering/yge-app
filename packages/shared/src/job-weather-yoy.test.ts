import { describe, expect, it } from 'vitest';

import type { WeatherLog } from './weather-log';

import { buildJobWeatherYoy } from './job-weather-yoy';

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

describe('buildJobWeatherYoy', () => {
  it('compares two years for one job', () => {
    const r = buildJobWeatherYoy({
      jobId: 'j1',
      currentYear: 2026,
      weatherLogs: [
        wx({ id: 'a', observedOn: '2025-04-15', lostHours: 4 }),
        wx({ id: 'b', observedOn: '2026-04-15', lostHours: 8 }),
      ],
    });
    expect(r.priorTotal).toBe(1);
    expect(r.currentTotal).toBe(1);
    expect(r.lostHoursDelta).toBe(4);
  });

  it('handles unknown job', () => {
    const r = buildJobWeatherYoy({ jobId: 'X', currentYear: 2026, weatherLogs: [] });
    expect(r.priorTotal).toBe(0);
  });
});
