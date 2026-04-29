// Portfolio incident year-over-year.
//
// Plain English: collapse two consecutive fiscal years of
// incidents into a single OSHA-300A-style YoY comparison.
// Used for the safety review and the EMR-trend conversation
// with the bonding agent.
//
// Per row: prior + current totalIncidents, byClassification,
// daysAway, daysRestricted, plus deltas.
//
// Different from incident-monthly-trend (per month),
// portfolio-incident-monthly (per month with classification +
// outcome breakdown).
//
// Pure derivation. No persisted records.

import type { Incident, IncidentClassification } from './incident';

export interface PortfolioIncidentYoyResult {
  priorYear: number;
  currentYear: number;
  priorTotalIncidents: number;
  priorByClassification: Partial<Record<IncidentClassification, number>>;
  priorDaysAway: number;
  priorDaysRestricted: number;
  currentTotalIncidents: number;
  currentByClassification: Partial<Record<IncidentClassification, number>>;
  currentDaysAway: number;
  currentDaysRestricted: number;
  totalIncidentsDelta: number;
  daysAwayDelta: number;
  daysRestrictedDelta: number;
}

export interface PortfolioIncidentYoyInputs {
  incidents: Incident[];
  /** The current (later) year. Prior year is currentYear - 1. */
  currentYear: number;
}

export function buildPortfolioIncidentYoy(
  inputs: PortfolioIncidentYoyInputs,
): PortfolioIncidentYoyResult {
  const priorYear = inputs.currentYear - 1;

  let priorTotalIncidents = 0;
  let priorDaysAway = 0;
  let priorDaysRestricted = 0;
  const priorByClassification = new Map<IncidentClassification, number>();
  let currentTotalIncidents = 0;
  let currentDaysAway = 0;
  let currentDaysRestricted = 0;
  const currentByClassification = new Map<IncidentClassification, number>();

  for (const inc of inputs.incidents) {
    const year = Number(inc.incidentDate.slice(0, 4));
    if (year === priorYear) {
      priorTotalIncidents += 1;
      priorDaysAway += inc.daysAway ?? 0;
      priorDaysRestricted += inc.daysRestricted ?? 0;
      priorByClassification.set(
        inc.classification,
        (priorByClassification.get(inc.classification) ?? 0) + 1,
      );
    } else if (year === inputs.currentYear) {
      currentTotalIncidents += 1;
      currentDaysAway += inc.daysAway ?? 0;
      currentDaysRestricted += inc.daysRestricted ?? 0;
      currentByClassification.set(
        inc.classification,
        (currentByClassification.get(inc.classification) ?? 0) + 1,
      );
    }
  }

  function toRecord(
    m: Map<IncidentClassification, number>,
  ): Partial<Record<IncidentClassification, number>> {
    const out: Partial<Record<IncidentClassification, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    priorYear,
    currentYear: inputs.currentYear,
    priorTotalIncidents,
    priorByClassification: toRecord(priorByClassification),
    priorDaysAway,
    priorDaysRestricted,
    currentTotalIncidents,
    currentByClassification: toRecord(currentByClassification),
    currentDaysAway,
    currentDaysRestricted,
    totalIncidentsDelta: currentTotalIncidents - priorTotalIncidents,
    daysAwayDelta: currentDaysAway - priorDaysAway,
    daysRestrictedDelta: currentDaysRestricted - priorDaysRestricted,
  };
}
