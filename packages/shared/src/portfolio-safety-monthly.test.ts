import { describe, expect, it } from 'vitest';

import type { Incident } from './incident';
import type { ToolboxTalk } from './toolbox-talk';
import type { WeatherLog } from './weather-log';

import { buildPortfolioSafetyMonthly } from './portfolio-safety-monthly';

function inc(over: Partial<Incident>): Incident {
  return {
    id: 'inc-1',
    createdAt: '',
    updatedAt: '',
    caseNumber: 'C-1',
    logYear: 2026,
    incidentDate: '2026-04-15',
    employeeName: 'Pat',
    location: 'Site',
    description: 'Test',
    classification: 'INJURY',
    outcome: 'DAYS_AWAY',
    daysAway: 5,
    daysRestricted: 0,
    privacyCase: false,
    ...over,
  } as Incident;
}

function tb(over: Partial<ToolboxTalk>): ToolboxTalk {
  return {
    id: 'tb-1',
    createdAt: '',
    updatedAt: '',
    heldOn: '2026-04-15',
    topic: 'Heat illness',
    leaderName: 'Pat',
    attendees: [
      { name: 'A', signed: true },
      { name: 'B', signed: false },
    ],
    ...over,
  } as ToolboxTalk;
}

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

describe('buildPortfolioSafetyMonthly', () => {
  it('combines incident + toolbox + weather data per month', () => {
    const r = buildPortfolioSafetyMonthly({
      incidents: [inc({ daysAway: 5 })],
      toolboxTalks: [tb({})],
      weatherLogs: [w({ lostHours: 4 })],
    });
    expect(r.rows[0]?.incidents).toBe(1);
    expect(r.rows[0]?.daysAway).toBe(5);
    expect(r.rows[0]?.toolboxTalks).toBe(1);
    expect(r.rows[0]?.signedAttendees).toBe(1);
    expect(r.rows[0]?.weatherLostHours).toBe(4);
  });

  it('breaks down by incident classification', () => {
    const r = buildPortfolioSafetyMonthly({
      incidents: [
        inc({ id: 'a', classification: 'INJURY' }),
        inc({ id: 'b', classification: 'SKIN_DISORDER' }),
        inc({ id: 'c', classification: 'INJURY' }),
      ],
      toolboxTalks: [],
      weatherLogs: [],
    });
    expect(r.rows[0]?.byClassification.INJURY).toBe(2);
    expect(r.rows[0]?.byClassification.SKIN_DISORDER).toBe(1);
  });

  it('sums daysAway + daysRestricted', () => {
    const r = buildPortfolioSafetyMonthly({
      incidents: [
        inc({ id: 'a', daysAway: 3, daysRestricted: 1 }),
        inc({ id: 'b', daysAway: 5, daysRestricted: 2 }),
      ],
      toolboxTalks: [],
      weatherLogs: [],
    });
    expect(r.rows[0]?.daysAway).toBe(8);
    expect(r.rows[0]?.daysRestricted).toBe(3);
  });

  it('respects fromMonth / toMonth across all 3 sources', () => {
    const r = buildPortfolioSafetyMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      incidents: [
        inc({ id: 'old', incidentDate: '2026-03-15' }),
        inc({ id: 'in', incidentDate: '2026-04-15' }),
      ],
      toolboxTalks: [
        tb({ id: 'old', heldOn: '2026-03-15' }),
        tb({ id: 'in', heldOn: '2026-04-15' }),
      ],
      weatherLogs: [
        w({ id: 'old', observedOn: '2026-03-15' }),
        w({ id: 'in', observedOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalIncidents).toBe(1);
    expect(r.rollup.totalToolboxTalks).toBe(1);
    expect(r.rollup.totalWeatherLostHours).toBe(4);
  });

  it('rolls up portfolio totals', () => {
    const r = buildPortfolioSafetyMonthly({
      incidents: [inc({})],
      toolboxTalks: [tb({}), tb({ id: 'tb-2' })],
      weatherLogs: [w({ lostHours: 8 })],
    });
    expect(r.rollup.totalIncidents).toBe(1);
    expect(r.rollup.totalToolboxTalks).toBe(2);
    expect(r.rollup.totalWeatherLostHours).toBe(8);
  });

  it('sorts by month asc', () => {
    const r = buildPortfolioSafetyMonthly({
      incidents: [
        inc({ id: 'a', incidentDate: '2026-06-15' }),
        inc({ id: 'b', incidentDate: '2026-04-15' }),
      ],
      toolboxTalks: [],
      weatherLogs: [],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[1]?.month).toBe('2026-06');
  });

  it('handles empty input', () => {
    const r = buildPortfolioSafetyMonthly({
      incidents: [],
      toolboxTalks: [],
      weatherLogs: [],
    });
    expect(r.rows).toHaveLength(0);
  });
});
