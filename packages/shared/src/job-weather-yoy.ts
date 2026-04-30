// Job-anchored weather year-over-year.
//
// Plain English: for one job, collapse two years of weather
// logs into a comparison: counts, lost hours, condition + impact
// mix, T8 §3395 heat trigger + compliance gaps, plus deltas.
//
// Pure derivation. No persisted records.

import type { WeatherCondition, WeatherImpact, WeatherLog } from './weather-log';

import { heatComplianceGap, shouldActivateHeatProcedures, shouldActivateHighHeatProcedures } from './weather-log';

export interface JobWeatherYoyResult {
  jobId: string;
  priorYear: number;
  currentYear: number;
  priorTotal: number;
  priorLostHours: number;
  priorImpactedDays: number;
  priorByCondition: Partial<Record<WeatherCondition, number>>;
  priorByImpact: Partial<Record<WeatherImpact, number>>;
  priorHeatTriggerDays: number;
  priorHeatComplianceGaps: number;
  currentTotal: number;
  currentLostHours: number;
  currentImpactedDays: number;
  currentByCondition: Partial<Record<WeatherCondition, number>>;
  currentByImpact: Partial<Record<WeatherImpact, number>>;
  currentHeatTriggerDays: number;
  currentHeatComplianceGaps: number;
  totalDelta: number;
  lostHoursDelta: number;
}

export interface JobWeatherYoyInputs {
  jobId: string;
  weatherLogs: WeatherLog[];
  currentYear: number;
}

export function buildJobWeatherYoy(inputs: JobWeatherYoyInputs): JobWeatherYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    total: number;
    lostHours: number;
    impactedDays: number;
    byCondition: Map<WeatherCondition, number>;
    byImpact: Map<WeatherImpact, number>;
    heatTriggerDays: number;
    heatComplianceGaps: number;
  };
  function emptyBucket(): Bucket {
    return {
      total: 0,
      lostHours: 0,
      impactedDays: 0,
      byCondition: new Map(),
      byImpact: new Map(),
      heatTriggerDays: 0,
      heatComplianceGaps: 0,
    };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const w of inputs.weatherLogs) {
    if (w.jobId !== inputs.jobId) continue;
    const year = Number(w.observedOn.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.total += 1;
    b.lostHours += w.lostHours ?? 0;
    if (w.impact && w.impact !== 'NONE') b.impactedDays += 1;
    b.byCondition.set(w.primaryCondition, (b.byCondition.get(w.primaryCondition) ?? 0) + 1);
    b.byImpact.set(w.impact, (b.byImpact.get(w.impact) ?? 0) + 1);
    if (shouldActivateHeatProcedures(w) || shouldActivateHighHeatProcedures(w)) b.heatTriggerDays += 1;
    const gap = heatComplianceGap(w);
    if (gap.missingHeatActivation || gap.missingHighHeatActivation) b.heatComplianceGaps += 1;
  }

  function condRecord(m: Map<WeatherCondition, number>): Partial<Record<WeatherCondition, number>> {
    const out: Partial<Record<WeatherCondition, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }
  function impRecord(m: Map<WeatherImpact, number>): Partial<Record<WeatherImpact, number>> {
    const out: Partial<Record<WeatherImpact, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    jobId: inputs.jobId,
    priorYear,
    currentYear: inputs.currentYear,
    priorTotal: prior.total,
    priorLostHours: prior.lostHours,
    priorImpactedDays: prior.impactedDays,
    priorByCondition: condRecord(prior.byCondition),
    priorByImpact: impRecord(prior.byImpact),
    priorHeatTriggerDays: prior.heatTriggerDays,
    priorHeatComplianceGaps: prior.heatComplianceGaps,
    currentTotal: current.total,
    currentLostHours: current.lostHours,
    currentImpactedDays: current.impactedDays,
    currentByCondition: condRecord(current.byCondition),
    currentByImpact: impRecord(current.byImpact),
    currentHeatTriggerDays: current.heatTriggerDays,
    currentHeatComplianceGaps: current.heatComplianceGaps,
    totalDelta: current.total - prior.total,
    lostHoursDelta: current.lostHours - prior.lostHours,
  };
}
