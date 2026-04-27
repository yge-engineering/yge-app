import { describe, expect, it } from 'vitest';
import { buildWeatherLostHoursSummary } from './weather-lost-hours';
import type { WeatherLog } from './weather-log';

function wx(over: Partial<WeatherLog>): WeatherLog {
  return {
    id: 'wx-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'job-1',
    observedOn: '2026-04-15',
    primaryCondition: 'CLEAR',
    impact: 'NONE',
    lostHours: 0,
    heatProceduresActivated: false,
    highHeatProceduresActivated: false,
    ...over,
  } as WeatherLog;
}

describe('buildWeatherLostHoursSummary', () => {
  it('counts days observed in the window', () => {
    const r = buildWeatherLostHoursSummary({
      start: '2026-04-01',
      end: '2026-04-30',
      weatherLog: [
        wx({ id: '1', observedOn: '2026-04-15' }),
        wx({ id: '2', observedOn: '2026-03-15' }), // out of window
        wx({ id: '3', observedOn: '2026-05-01' }), // out of window
      ],
    });
    expect(r.daysObserved).toBe(1);
  });

  it('sums totalLostHours and tallies by impact', () => {
    const r = buildWeatherLostHoursSummary({
      start: '2026-04-01',
      end: '2026-04-30',
      weatherLog: [
        wx({ id: '1', impact: 'NONE', lostHours: 0 }),
        wx({ id: '2', impact: 'PARTIAL', lostHours: 4 }),
        wx({ id: '3', impact: 'STOPPED', lostHours: 8 }),
        wx({ id: '4', impact: 'PARTIAL', lostHours: 2 }),
      ],
    });
    expect(r.totalLostHours).toBe(14);
    expect(r.byImpact.NONE).toBe(1);
    expect(r.byImpact.PARTIAL).toBe(2);
    expect(r.byImpact.STOPPED).toBe(1);
  });

  it('per-job rollup splits stopped vs partial days', () => {
    const r = buildWeatherLostHoursSummary({
      start: '2026-04-01',
      end: '2026-04-30',
      weatherLog: [
        wx({ id: '1', jobId: 'job-A', impact: 'STOPPED', lostHours: 8 }),
        wx({ id: '2', jobId: 'job-A', impact: 'PARTIAL', lostHours: 4 }),
        wx({ id: '3', jobId: 'job-A', impact: 'NONE' }),
        wx({ id: '4', jobId: 'job-B', impact: 'STOPPED', lostHours: 8 }),
      ],
    });
    const a = r.byJob.find((x) => x.jobId === 'job-A')!;
    expect(a.daysObserved).toBe(3);
    expect(a.daysStopped).toBe(1);
    expect(a.daysPartial).toBe(1);
    expect(a.daysWithImpact).toBe(2);
    expect(a.totalLostHours).toBe(12);
  });

  it('byCondition tallies primary conditions', () => {
    const r = buildWeatherLostHoursSummary({
      start: '2026-04-01',
      end: '2026-04-30',
      weatherLog: [
        wx({ primaryCondition: 'HEAVY_RAIN', impact: 'STOPPED', lostHours: 8 }),
        wx({ primaryCondition: 'HEAVY_RAIN', impact: 'PARTIAL', lostHours: 4 }),
        wx({ primaryCondition: 'WIND', impact: 'PARTIAL', lostHours: 2 }),
      ],
    });
    expect(r.byCondition.HEAVY_RAIN).toBe(2);
    expect(r.byCondition.WIND).toBe(1);
  });

  it('sorts byJob highest lost-hours first', () => {
    const r = buildWeatherLostHoursSummary({
      start: '2026-04-01',
      end: '2026-04-30',
      weatherLog: [
        wx({ id: '1', jobId: 'a', lostHours: 2, impact: 'PARTIAL' }),
        wx({ id: '2', jobId: 'b', lostHours: 16, impact: 'STOPPED' }),
        wx({ id: '3', jobId: 'c', lostHours: 4, impact: 'PARTIAL' }),
      ],
    });
    expect(r.byJob.map((x) => x.jobId)).toEqual(['b', 'c', 'a']);
  });

  it('handles empty window cleanly', () => {
    const r = buildWeatherLostHoursSummary({
      start: '2026-04-01',
      end: '2026-04-30',
      weatherLog: [],
    });
    expect(r.daysObserved).toBe(0);
    expect(r.totalLostHours).toBe(0);
    expect(r.byJob).toHaveLength(0);
  });
});
