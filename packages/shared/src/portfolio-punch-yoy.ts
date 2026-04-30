// Portfolio punch list activity year-over-year.
//
// Plain English: collapse two years of punch-item identified
// + closed events into a comparison row with severity mix on
// identified + delta. Sized for the "are we closing out faster"
// review.
//
// Different from portfolio-punch-monthly (per month).
//
// Pure derivation. No persisted records.

import type { PunchItem, PunchItemSeverity } from './punch-list';

export interface PortfolioPunchYoyResult {
  priorYear: number;
  currentYear: number;
  priorIdentified: number;
  priorClosed: number;
  priorIdentifiedBySeverity: Partial<Record<PunchItemSeverity, number>>;
  currentIdentified: number;
  currentClosed: number;
  currentIdentifiedBySeverity: Partial<Record<PunchItemSeverity, number>>;
  identifiedDelta: number;
  closedDelta: number;
}

export interface PortfolioPunchYoyInputs {
  punchItems: PunchItem[];
  currentYear: number;
}

export function buildPortfolioPunchYoy(
  inputs: PortfolioPunchYoyInputs,
): PortfolioPunchYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    identified: number;
    closed: number;
    bySeverity: Map<PunchItemSeverity, number>;
  };
  function emptyBucket(): Bucket {
    return { identified: 0, closed: 0, bySeverity: new Map() };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const p of inputs.punchItems) {
    const idYear = Number(p.identifiedOn.slice(0, 4));
    let idBucket: Bucket | null = null;
    if (idYear === priorYear) idBucket = prior;
    else if (idYear === inputs.currentYear) idBucket = current;
    if (idBucket) {
      idBucket.identified += 1;
      const sev: PunchItemSeverity = p.severity ?? 'MINOR';
      idBucket.bySeverity.set(sev, (idBucket.bySeverity.get(sev) ?? 0) + 1);
    }

    if (p.closedOn) {
      const closedYear = Number(p.closedOn.slice(0, 4));
      let closedBucket: Bucket | null = null;
      if (closedYear === priorYear) closedBucket = prior;
      else if (closedYear === inputs.currentYear) closedBucket = current;
      if (closedBucket) closedBucket.closed += 1;
    }
  }

  function toRecord(m: Map<PunchItemSeverity, number>): Partial<Record<PunchItemSeverity, number>> {
    const out: Partial<Record<PunchItemSeverity, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    priorYear,
    currentYear: inputs.currentYear,
    priorIdentified: prior.identified,
    priorClosed: prior.closed,
    priorIdentifiedBySeverity: toRecord(prior.bySeverity),
    currentIdentified: current.identified,
    currentClosed: current.closed,
    currentIdentifiedBySeverity: toRecord(current.bySeverity),
    identifiedDelta: current.identified - prior.identified,
    closedDelta: current.closed - prior.closed,
  };
}
