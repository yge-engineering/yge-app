// Portfolio subcontractor COI year-over-year.
//
// Plain English: collapse two years of subcontractor COI
// expiry dates into a comparison row. Sized for the year-end
// "how much COI chase work is in front of us per year"
// planning.
//
// Different from portfolio-coi-monthly-expiring (per month).
//
// Pure derivation. No persisted records.

import type { Vendor } from './vendor';

export interface PortfolioCoiYoyResult {
  priorYear: number;
  currentYear: number;
  priorTotal: number;
  priorOnHoldCount: number;
  currentTotal: number;
  currentOnHoldCount: number;
  totalDelta: number;
}

export interface PortfolioCoiYoyInputs {
  vendors: Vendor[];
  currentYear: number;
}

export function buildPortfolioCoiYoy(
  inputs: PortfolioCoiYoyInputs,
): PortfolioCoiYoyResult {
  const priorYear = inputs.currentYear - 1;

  let priorTotal = 0;
  let priorOnHold = 0;
  let currentTotal = 0;
  let currentOnHold = 0;

  for (const v of inputs.vendors) {
    if (v.kind !== 'SUBCONTRACTOR') continue;
    if (!v.coiOnFile) continue;
    if (!v.coiExpiresOn) continue;
    const year = Number(v.coiExpiresOn.slice(0, 4));
    if (year === priorYear) {
      priorTotal += 1;
      if (v.onHold === true) priorOnHold += 1;
    } else if (year === inputs.currentYear) {
      currentTotal += 1;
      if (v.onHold === true) currentOnHold += 1;
    }
  }

  return {
    priorYear,
    currentYear: inputs.currentYear,
    priorTotal,
    priorOnHoldCount: priorOnHold,
    currentTotal,
    currentOnHoldCount: currentOnHold,
    totalDelta: currentTotal - priorTotal,
  };
}
