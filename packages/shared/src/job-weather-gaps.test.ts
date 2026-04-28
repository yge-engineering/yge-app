import { describe, expect, it } from 'vitest';

import type { WeatherLog } from './weather-log';

import { buildJobWeatherGaps } from './job-weather-gaps';

function wx(over: Partial<WeatherLog>): WeatherLog {
  return {
    id: 'wx-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
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

describe('buildJobWeatherGaps', () => {
  it('flags every day with no observation', () => {
    // Window 4/13 (Mon) - 4/15 (Wed). Only 4/14 has a log.
    const r = buildJobWeatherGaps({
      jobId: 'j1',
      fromDate: '2026-04-13',
      toDate: '2026-04-15',
      weatherLogs: [wx({ observedOn: '2026-04-14' })],
    });
    expect(r.daysConsidered).toBe(3);
    expect(r.daysWithObservation).toBe(1);
    const missing = r.gaps.filter((g) => g.kind === 'MISSING_OBSERVATION');
    expect(missing.map((g) => g.date)).toEqual(['2026-04-13', '2026-04-15']);
  });

  it('honors skipWeekends', () => {
    // 4/11 Sat, 4/12 Sun, 4/13 Mon, 4/14 Tue.
    const r = buildJobWeatherGaps({
      jobId: 'j1',
      fromDate: '2026-04-11',
      toDate: '2026-04-14',
      weatherLogs: [wx({ observedOn: '2026-04-13' })],
      skipWeekends: true,
    });
    // Only Mon + Tue counted (2 days).
    expect(r.daysConsidered).toBe(2);
    expect(r.daysWithObservation).toBe(1);
  });

  it('flags impact without lost hours', () => {
    const r = buildJobWeatherGaps({
      jobId: 'j1',
      fromDate: '2026-04-15',
      toDate: '2026-04-15',
      weatherLogs: [
        wx({ observedOn: '2026-04-15', impact: 'STOPPED', lostHours: 0 }),
      ],
    });
    const flagged = r.gaps.filter((g) => g.kind === 'IMPACT_WITHOUT_LOST_HOURS');
    expect(flagged).toHaveLength(1);
  });

  it('does not flag impact when lostHours present', () => {
    const r = buildJobWeatherGaps({
      jobId: 'j1',
      fromDate: '2026-04-15',
      toDate: '2026-04-15',
      weatherLogs: [
        wx({ observedOn: '2026-04-15', impact: 'PARTIAL', lostHours: 4 }),
      ],
    });
    expect(r.gaps).toHaveLength(0);
  });

  it('counts heat trigger days when highF >= 80', () => {
    const r = buildJobWeatherGaps({
      jobId: 'j1',
      fromDate: '2026-04-15',
      toDate: '2026-04-17',
      weatherLogs: [
        wx({ id: 'a', observedOn: '2026-04-15', highF: 79 }),  // below
        wx({ id: 'b', observedOn: '2026-04-16', highF: 80, heatProceduresActivated: true }),
        wx({ id: 'c', observedOn: '2026-04-17', highF: 92, heatProceduresActivated: false }),
      ],
    });
    expect(r.heatTriggerDays).toBe(2);
    expect(r.heatTriggerMisses).toBe(1);
    const heatGaps = r.gaps.filter((g) => g.kind === 'HEAT_TRIGGER_NOT_FLAGGED');
    expect(heatGaps).toHaveLength(1);
    expect(heatGaps[0]?.date).toBe('2026-04-17');
  });

  it('observation coverage is days with log / days considered', () => {
    const r = buildJobWeatherGaps({
      jobId: 'j1',
      fromDate: '2026-04-15',
      toDate: '2026-04-18', // 4 days
      weatherLogs: [
        wx({ id: 'a', observedOn: '2026-04-15' }),
        wx({ id: 'b', observedOn: '2026-04-17' }),
      ],
    });
    expect(r.daysConsidered).toBe(4);
    expect(r.daysWithObservation).toBe(2);
    expect(r.observationCoverage).toBe(0.5);
  });

  it('only considers logs for the named job', () => {
    const r = buildJobWeatherGaps({
      jobId: 'j1',
      fromDate: '2026-04-15',
      toDate: '2026-04-15',
      weatherLogs: [
        wx({ jobId: 'j2', observedOn: '2026-04-15' }),
      ],
    });
    expect(r.daysWithObservation).toBe(0);
  });

  it('window-filters logs', () => {
    const r = buildJobWeatherGaps({
      jobId: 'j1',
      fromDate: '2026-04-15',
      toDate: '2026-04-16',
      weatherLogs: [
        wx({ id: 'old', observedOn: '2026-04-01' }),
        wx({ id: 'in', observedOn: '2026-04-15' }),
        wx({ id: 'after', observedOn: '2026-05-01' }),
      ],
    });
    expect(r.daysWithObservation).toBe(1);
  });

  it('sorts gaps by date asc, then by kind asc', () => {
    const r = buildJobWeatherGaps({
      jobId: 'j1',
      fromDate: '2026-04-15',
      toDate: '2026-04-17',
      weatherLogs: [
        // 4/16 has impact-without-hours AND heat trigger not flagged
        wx({ observedOn: '2026-04-16', impact: 'PARTIAL', lostHours: 0, highF: 95 }),
      ],
    });
    // Expected gaps (sorted): 4/15 missing, 4/16 heat, 4/16 impact, 4/17 missing
    expect(r.gaps[0]?.date).toBe('2026-04-15');
    expect(r.gaps[0]?.kind).toBe('MISSING_OBSERVATION');
    expect(r.gaps[1]?.date).toBe('2026-04-16');
    expect(r.gaps[1]?.kind).toBe('HEAT_TRIGGER_NOT_FLAGGED');
    expect(r.gaps[2]?.date).toBe('2026-04-16');
    expect(r.gaps[2]?.kind).toBe('IMPACT_WITHOUT_LOST_HOURS');
    expect(r.gaps[3]?.date).toBe('2026-04-17');
  });
});
