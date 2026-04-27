import { describe, expect, it } from 'vitest';
import {
  computeWeatherLogRollup,
  heatComplianceGap,
  shouldActivateHeatProcedures,
  shouldActivateHighHeatProcedures,
  type WeatherLog,
} from './weather-log';

function wx(over: Partial<WeatherLog>): WeatherLog {
  return {
    id: 'wx-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    jobId: 'job-2026-01-01-test-aaaaaaaa',
    observedOn: '2026-04-01',
    primaryCondition: 'CLEAR',
    impact: 'NONE',
    lostHours: 0,
    heatProceduresActivated: false,
    highHeatProceduresActivated: false,
    ...over,
  };
}

describe('shouldActivateHeatProcedures', () => {
  it('triggers at exactly 80°F', () => {
    expect(shouldActivateHeatProcedures({ highF: 80 })).toBe(true);
  });
  it('does not trigger at 79°F', () => {
    expect(shouldActivateHeatProcedures({ highF: 79 })).toBe(false);
  });
  it('does not trigger when high temp is missing', () => {
    expect(shouldActivateHeatProcedures({})).toBe(false);
  });
});

describe('shouldActivateHighHeatProcedures', () => {
  it('triggers at exactly 95°F', () => {
    expect(shouldActivateHighHeatProcedures({ highF: 95 })).toBe(true);
  });
  it('does not trigger at 94°F', () => {
    expect(shouldActivateHighHeatProcedures({ highF: 94 })).toBe(false);
  });
});

describe('heatComplianceGap', () => {
  it('flags base activation when temp >= 80 but not activated', () => {
    const r = heatComplianceGap(wx({ highF: 85, heatProceduresActivated: false }));
    expect(r.missingHeatActivation).toBe(true);
  });
  it('flags high-heat activation when temp >= 95 but not activated', () => {
    const r = heatComplianceGap(wx({
      highF: 100,
      heatProceduresActivated: true,
      highHeatProceduresActivated: false,
    }));
    expect(r.missingHighHeatActivation).toBe(true);
  });
  it('clean when temp under 80', () => {
    const r = heatComplianceGap(wx({ highF: 70 }));
    expect(r.missingHeatActivation).toBe(false);
    expect(r.missingHighHeatActivation).toBe(false);
  });
});

describe('computeWeatherLogRollup', () => {
  it('counts heat triggers + compliance gaps separately', () => {
    const r = computeWeatherLogRollup([
      wx({ id: 'wx-11111111', highF: 70 }),
      wx({
        id: 'wx-22222222',
        highF: 85,
        heatProceduresActivated: false,
      }),
      wx({
        id: 'wx-33333333',
        highF: 100,
        heatProceduresActivated: true,
        highHeatProceduresActivated: true,
      }),
      wx({
        id: 'wx-44444444',
        highF: 100,
        heatProceduresActivated: true,
        highHeatProceduresActivated: false,
      }),
    ]);
    expect(r.total).toBe(4);
    expect(r.heatTriggerDays).toBe(3);
    expect(r.highHeatTriggerDays).toBe(2);
    // wx-22222222 and wx-44444444 are gaps
    expect(r.heatComplianceGaps).toBe(2);
  });

  it('sums lost hours and impacted days', () => {
    const r = computeWeatherLogRollup([
      wx({ id: 'wx-11111111', impact: 'NONE', lostHours: 0 }),
      wx({ id: 'wx-22222222', impact: 'PARTIAL', lostHours: 4 }),
      wx({ id: 'wx-33333333', impact: 'STOPPED', lostHours: 8 }),
    ]);
    expect(r.totalLostHours).toBe(12);
    expect(r.impactedDays).toBe(2);
  });
});
