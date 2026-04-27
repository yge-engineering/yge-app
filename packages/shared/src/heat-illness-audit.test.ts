import { describe, expect, it } from 'vitest';
import { buildHeatIllnessAudit } from './heat-illness-audit';
import type { WeatherLog } from './weather-log';

function wx(over: Partial<WeatherLog>): WeatherLog {
  return {
    id: 'wx-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'job-1',
    observedOn: '2026-07-15',
    primaryCondition: 'CLEAR',
    impact: 'NONE',
    lostHours: 0,
    heatProceduresActivated: false,
    highHeatProceduresActivated: false,
    highF: 70,
    ...over,
  } as WeatherLog;
}

describe('buildHeatIllnessAudit', () => {
  it('flags HEAT_PROCS_REQUIRED_NOT_ACTIVATED at >=80F with flag off', () => {
    const r = buildHeatIllnessAudit({
      start: '2026-07-01',
      end: '2026-07-31',
      weatherLog: [
        wx({ id: '1', observedOn: '2026-07-10', highF: 85, heatProceduresActivated: false }),
      ],
    });
    expect(r.heatRequiredDays).toBe(1);
    expect(r.heatCompliantDays).toBe(0);
    expect(r.violations[0]?.kind).toBe('HEAT_PROCS_REQUIRED_NOT_ACTIVATED');
  });

  it('compliant at >=80F when heatProceduresActivated=true', () => {
    const r = buildHeatIllnessAudit({
      start: '2026-07-01',
      end: '2026-07-31',
      weatherLog: [
        wx({ highF: 90, heatProceduresActivated: true }),
      ],
    });
    expect(r.heatCompliantDays).toBe(1);
    expect(r.violations).toHaveLength(0);
  });

  it('flags HIGH_HEAT_PROCS_REQUIRED_NOT_ACTIVATED at >=95F with high-heat flag off', () => {
    const r = buildHeatIllnessAudit({
      start: '2026-07-01',
      end: '2026-07-31',
      weatherLog: [
        wx({
          id: '1',
          highF: 100,
          heatProceduresActivated: true,
          highHeatProceduresActivated: false,
        }),
      ],
    });
    // >=80 procs ARE active so partialCompliance=true on the
    // high-heat violation.
    expect(r.heatRequiredDays).toBe(1);
    expect(r.heatCompliantDays).toBe(1);
    expect(r.highHeatRequiredDays).toBe(1);
    expect(r.highHeatCompliantDays).toBe(0);
    expect(r.violations[0]?.kind).toBe('HIGH_HEAT_PROCS_REQUIRED_NOT_ACTIVATED');
    expect(r.violations[0]?.partialCompliance).toBe(true);
  });

  it('skips days under 80F', () => {
    const r = buildHeatIllnessAudit({
      start: '2026-07-01',
      end: '2026-07-31',
      weatherLog: [wx({ highF: 70, heatProceduresActivated: false })],
    });
    expect(r.heatRequiredDays).toBe(0);
    expect(r.violations).toHaveLength(0);
  });

  it('skips days with no highF reading', () => {
    const r = buildHeatIllnessAudit({
      start: '2026-07-01',
      end: '2026-07-31',
      weatherLog: [wx({ highF: undefined, heatProceduresActivated: false })],
    });
    expect(r.heatRequiredDays).toBe(0);
  });

  it('respects the date window', () => {
    const r = buildHeatIllnessAudit({
      start: '2026-07-01',
      end: '2026-07-31',
      weatherLog: [
        wx({ id: '1', observedOn: '2026-06-15', highF: 100 }),
        wx({ id: '2', observedOn: '2026-07-15', highF: 100 }),
        wx({ id: '3', observedOn: '2026-08-15', highF: 100 }),
      ],
    });
    expect(r.daysAudited).toBe(1);
  });

  it('100% compliance rate when no heat days in window', () => {
    const r = buildHeatIllnessAudit({
      start: '2026-01-01',
      end: '2026-01-31',
      weatherLog: [wx({ observedOn: '2026-01-15', highF: 50 })],
    });
    expect(r.heatComplianceRate).toBe(1);
    expect(r.highHeatComplianceRate).toBe(1);
  });

  it('honors custom thresholds', () => {
    const r = buildHeatIllnessAudit({
      start: '2026-07-01',
      end: '2026-07-31',
      weatherLog: [wx({ highF: 75 })],
      heatThresholdF: 70,
    });
    expect(r.heatRequiredDays).toBe(1);
  });

  it('sorts violations by highest temp first', () => {
    const r = buildHeatIllnessAudit({
      start: '2026-07-01',
      end: '2026-07-31',
      weatherLog: [
        wx({ id: '1', observedOn: '2026-07-05', highF: 82, heatProceduresActivated: false }),
        wx({ id: '2', observedOn: '2026-07-15', highF: 105, heatProceduresActivated: false, highHeatProceduresActivated: false }),
        wx({ id: '3', observedOn: '2026-07-25', highF: 95, heatProceduresActivated: false, highHeatProceduresActivated: false }),
      ],
    });
    // 105F day produces TWO violations (heat + high-heat). 95F day
    // also produces both. 82F day produces just one. Sort puts 105F
    // entries first (highest temps).
    expect(r.violations[0]?.highF).toBe(105);
  });
});
