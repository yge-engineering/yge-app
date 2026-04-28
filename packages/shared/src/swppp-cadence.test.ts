import { describe, expect, it } from 'vitest';

import type { SwpppInspection } from './swppp-inspection';
import type { WeatherLog } from './weather-log';

import { buildSwpppCadence } from './swppp-cadence';

function ins(over: Partial<SwpppInspection>): SwpppInspection {
  return {
    id: 'swp-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'j1',
    inspectedOn: '2026-04-06',
    trigger: 'WEEKLY',
    inspectorName: 'Ryan Young',
    rainForecast: false,
    qualifyingRainEvent: false,
    dischargeOccurred: false,
    bmpChecks: [],
    ...over,
  } as SwpppInspection;
}

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

describe('buildSwpppCadence', () => {
  it('flags weeks with no inspection logged', () => {
    // Window 4/6 (Mon) - 4/19 (Sun): two weeks. Only week 1 has an inspection.
    const r = buildSwpppCadence({
      jobId: 'j1',
      fromDate: '2026-04-06',
      toDate: '2026-04-19',
      inspections: [ins({ inspectedOn: '2026-04-08' })],
      weatherLogs: [],
    });
    expect(r.weeksConsidered).toBe(2);
    expect(r.weeksWithInspection).toBe(1);
    const missed = r.gaps.filter((g) => g.kind === 'MISSED_WEEKLY');
    expect(missed).toHaveLength(1);
    expect(missed[0]?.anchorDate).toBe('2026-04-13');
  });

  it('counts qualifying storms by precip threshold', () => {
    const r = buildSwpppCadence({
      jobId: 'j1',
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      inspections: [],
      weatherLogs: [
        wx({ id: 'a', observedOn: '2026-04-10', precipHundredthsInch: 30 }), // 0.30"
        wx({ id: 'b', observedOn: '2026-04-15', precipHundredthsInch: 80 }), // 0.80"
        wx({ id: 'c', observedOn: '2026-04-20', precipHundredthsInch: 50 }), // 0.50" exact
      ],
    });
    // 0.30" below threshold; 0.80" + 0.50" qualify.
    expect(r.qualifyingStorms).toBe(2);
  });

  it('flags missed pre-storm inspection', () => {
    // Storm on 4/15, no inspection 4/14 or PRE_STORM-tagged on 4/15.
    const r = buildSwpppCadence({
      jobId: 'j1',
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      inspections: [
        ins({ inspectedOn: '2026-04-16', trigger: 'POST_STORM' }),
      ],
      weatherLogs: [
        wx({ id: 's', observedOn: '2026-04-15', precipHundredthsInch: 80 }),
      ],
    });
    const pre = r.gaps.filter((g) => g.kind === 'MISSED_PRE_STORM');
    expect(pre).toHaveLength(1);
    expect(pre[0]?.anchorDate).toBe('2026-04-15');
  });

  it('counts pre-storm inspection on day-before as covered', () => {
    const r = buildSwpppCadence({
      jobId: 'j1',
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      inspections: [
        // Day-before inspection — counts as pre-storm regardless of trigger.
        ins({ inspectedOn: '2026-04-14' }),
        // Post-storm covered same day with POST_STORM trigger.
        ins({ id: 'swp-2', inspectedOn: '2026-04-15', trigger: 'POST_STORM' }),
      ],
      weatherLogs: [
        wx({ id: 's', observedOn: '2026-04-15', precipHundredthsInch: 80 }),
      ],
    });
    expect(r.stormsWithPreInspection).toBe(1);
    expect(r.stormsWithPostInspection).toBe(1);
    expect(r.gaps.filter((g) => g.kind !== 'MISSED_WEEKLY')).toHaveLength(0);
  });

  it('flags missed post-storm if no inspection within 48 hours', () => {
    const r = buildSwpppCadence({
      jobId: 'j1',
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      inspections: [
        // pre-storm covered
        ins({ inspectedOn: '2026-04-14' }),
        // inspection 3 days after — outside 48h post-storm window
        ins({ id: 'swp-2', inspectedOn: '2026-04-18', trigger: 'POST_STORM' }),
      ],
      weatherLogs: [
        wx({ id: 's', observedOn: '2026-04-15', precipHundredthsInch: 80 }),
      ],
    });
    const post = r.gaps.filter((g) => g.kind === 'MISSED_POST_STORM');
    expect(post).toHaveLength(1);
    expect(post[0]?.anchorDate).toBe('2026-04-15');
  });

  it('respects qualifyingStormHundredths override', () => {
    const r = buildSwpppCadence({
      jobId: 'j1',
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      qualifyingStormHundredths: 25, // 0.25"
      inspections: [],
      weatherLogs: [
        wx({ id: 'a', observedOn: '2026-04-10', precipHundredthsInch: 30 }),
      ],
    });
    expect(r.qualifyingStorms).toBe(1);
  });

  it('only considers inspections + weather for the named job', () => {
    const r = buildSwpppCadence({
      jobId: 'j1',
      fromDate: '2026-04-06',
      toDate: '2026-04-12',
      inspections: [
        ins({ inspectedOn: '2026-04-08', jobId: 'j2' }), // wrong job
      ],
      weatherLogs: [],
    });
    expect(r.inspectionsConsidered).toBe(0);
    expect(r.weeksWithInspection).toBe(0);
  });

  it('window-filters inspections + weather by date', () => {
    const r = buildSwpppCadence({
      jobId: 'j1',
      fromDate: '2026-04-06',
      toDate: '2026-04-12',
      inspections: [
        ins({ id: 'before', inspectedOn: '2026-03-30' }),  // before window
        ins({ id: 'inside', inspectedOn: '2026-04-08' }),  // inside
        ins({ id: 'after',  inspectedOn: '2026-04-20' }),  // after
      ],
      weatherLogs: [
        wx({ id: 'before', observedOn: '2026-03-15', precipHundredthsInch: 80 }),
        wx({ id: 'inside', observedOn: '2026-04-10', precipHundredthsInch: 80 }),
      ],
    });
    expect(r.inspectionsConsidered).toBe(1);
    // Only the in-window storm counts.
    expect(r.qualifyingStorms).toBe(1);
  });
});
