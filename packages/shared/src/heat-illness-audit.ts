// Cal/OSHA T8 §3395 heat-illness compliance audit.
//
// Plain English: §3395 mandates heat-illness procedures whenever the
// outdoor air temperature reaches 80 °F:
//   - access to shade
//   - access to fresh, cool water (1 quart per worker per hour)
//   - cool-down rests as needed
//   - written procedures + supervisor + worker training
//
// At 95 °F, "high-heat" procedures kick in additionally:
//   - effective communication with each crew member
//   - observation of acclimatizing employees
//   - mandatory cool-down rest periods (10 min every 2 hours)
//   - pre-shift meetings on the heat plan
//
// Every weather log we record carries highF + heatProceduresActivated +
// highHeatProceduresActivated. This module audits the log over a date
// range and flags days where temps triggered the rule but the flag is
// off — that's a Cal/OSHA citation in a §3395 audit.
//
// Pure derivation. No persisted records.

import type { WeatherLog } from './weather-log';

export const HEAT_PROCEDURES_THRESHOLD_F = 80;
export const HIGH_HEAT_PROCEDURES_THRESHOLD_F = 95;

export type HeatViolationKind =
  | 'HEAT_PROCS_REQUIRED_NOT_ACTIVATED'
  | 'HIGH_HEAT_PROCS_REQUIRED_NOT_ACTIVATED';

export interface HeatViolationRow {
  weatherLogId: string;
  jobId: string;
  observedOn: string;
  highF: number;
  kind: HeatViolationKind;
  /** True iff the lower-tier (>= 80) procedures were activated even
   *  though high-heat (>= 95) wasn't. */
  partialCompliance: boolean;
}

export interface HeatIllnessAudit {
  start: string;
  end: string;
  /** Number of weather logs in the period. */
  daysAudited: number;
  /** Days highF >= 80 °F (procedures required). */
  heatRequiredDays: number;
  /** Days highF >= 95 °F (high-heat required). */
  highHeatRequiredDays: number;
  /** Days with the heat-procedures flag set when it was required. */
  heatCompliantDays: number;
  /** Days with the high-heat flag set when it was required. */
  highHeatCompliantDays: number;
  violations: HeatViolationRow[];
  /** heatCompliantDays / heatRequiredDays — clamps to 1 when no heat
   *  days in the period. */
  heatComplianceRate: number;
  /** highHeatCompliantDays / highHeatRequiredDays. */
  highHeatComplianceRate: number;
}

export interface HeatIllnessAuditInputs {
  start: string;
  end: string;
  weatherLog: WeatherLog[];
  /** Override the >=80°F threshold if needed. */
  heatThresholdF?: number;
  highHeatThresholdF?: number;
}

export function buildHeatIllnessAudit(
  inputs: HeatIllnessAuditInputs,
): HeatIllnessAudit {
  const { start, end } = inputs;
  const heatT = inputs.heatThresholdF ?? HEAT_PROCEDURES_THRESHOLD_F;
  const highT = inputs.highHeatThresholdF ?? HIGH_HEAT_PROCEDURES_THRESHOLD_F;

  const inWindow = inputs.weatherLog.filter(
    (w) => w.observedOn >= start && w.observedOn <= end,
  );

  const violations: HeatViolationRow[] = [];
  let heatRequiredDays = 0;
  let highHeatRequiredDays = 0;
  let heatCompliantDays = 0;
  let highHeatCompliantDays = 0;

  for (const w of inWindow) {
    const high = typeof w.highF === 'number' ? w.highF : null;
    if (high == null) continue;

    if (high >= heatT) {
      heatRequiredDays += 1;
      if (w.heatProceduresActivated) heatCompliantDays += 1;
      else {
        violations.push({
          weatherLogId: w.id,
          jobId: w.jobId,
          observedOn: w.observedOn,
          highF: high,
          kind: 'HEAT_PROCS_REQUIRED_NOT_ACTIVATED',
          partialCompliance: false,
        });
      }
    }
    if (high >= highT) {
      highHeatRequiredDays += 1;
      if (w.highHeatProceduresActivated) highHeatCompliantDays += 1;
      else {
        violations.push({
          weatherLogId: w.id,
          jobId: w.jobId,
          observedOn: w.observedOn,
          highF: high,
          kind: 'HIGH_HEAT_PROCS_REQUIRED_NOT_ACTIVATED',
          // True if the >=80 regs were activated, just not >=95 ones.
          partialCompliance: !!w.heatProceduresActivated,
        });
      }
    }
  }

  // Sort violations: highest temp first.
  violations.sort((a, b) => b.highF - a.highF);

  return {
    start,
    end,
    daysAudited: inWindow.length,
    heatRequiredDays,
    highHeatRequiredDays,
    heatCompliantDays,
    highHeatCompliantDays,
    violations,
    heatComplianceRate:
      heatRequiredDays === 0 ? 1 : heatCompliantDays / heatRequiredDays,
    highHeatComplianceRate:
      highHeatRequiredDays === 0
        ? 1
        : highHeatCompliantDays / highHeatRequiredDays,
  };
}
