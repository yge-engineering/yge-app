// Davis-Bacon vs CA Prevailing Wage comparator.
//
// On federal-aid contracts (most Caltrans projects with FHWA
// funding, USFS / BLM jobs) the wage rate paid to each
// classification must be at least the HIGHER of:
//   - the CA DIR prevailing wage decision for that classification
//   - the federal Davis-Bacon decision for that classification
//
// 29 CFR 5.5(a)(1)(i) — Davis-Bacon Act, as amended. CA PWD
// is governed by Labor Code §1773-§1781. When a contractor
// underpays either, the agency can withhold contract funds
// AND the worker has a private right of action.
//
// This helper takes the rate (base + fringe) for one
// classification from each decision and returns the controlling
// rate plus a plain-English reason. Pure data-in / data-out;
// no IO.

import type { Cents } from './money';

export interface WageDecisionLine {
  /** Hourly base rate, cents. */
  hourlyBaseCents: Cents;
  /** Hourly fringe rate, cents. Federal calls this "fringe
   *  benefits"; CA calls this "predetermined fringes". */
  hourlyFringeCents: Cents;
  /** "CA PWD" / "Davis-Bacon" / "Davis-Bacon CA-30 2025-05" —
   *  free-form so the UI can print the source. */
  sourceLabel: string;
}

export interface WageComparisonResult {
  /** Sum of base + fringe for the controlling decision. */
  controllingTotalCents: Cents;
  /** Which decision wins. */
  controllingSource: 'ca-pwd' | 'davis-bacon' | 'tie';
  /** Plain-English reason — printable on the CPR header or in
   *  the bid-prep checklist. */
  reason: string;
  /** Both source labels for printability. */
  sources: { caPwd: string; davisBacon: string };
}

export function compareWageDecisions(
  caPwd: WageDecisionLine,
  davisBacon: WageDecisionLine,
): WageComparisonResult {
  const caTotal = caPwd.hourlyBaseCents + caPwd.hourlyFringeCents;
  const dbTotal = davisBacon.hourlyBaseCents + davisBacon.hourlyFringeCents;
  const sources = {
    caPwd: caPwd.sourceLabel,
    davisBacon: davisBacon.sourceLabel,
  };
  if (caTotal === dbTotal) {
    return {
      controllingTotalCents: caTotal,
      controllingSource: 'tie',
      reason: `CA PWD and Davis-Bacon match at ${formatCentsHourly(caTotal)}.`,
      sources,
    };
  }
  if (caTotal > dbTotal) {
    return {
      controllingTotalCents: caTotal,
      controllingSource: 'ca-pwd',
      reason:
        `CA PWD controls: ${formatCentsHourly(caTotal)} > Davis-Bacon ${formatCentsHourly(dbTotal)}.`,
      sources,
    };
  }
  return {
    controllingTotalCents: dbTotal,
    controllingSource: 'davis-bacon',
    reason:
      `Davis-Bacon controls: ${formatCentsHourly(dbTotal)} > CA PWD ${formatCentsHourly(caTotal)}.`,
    sources,
  };
}

function formatCentsHourly(cents: Cents): string {
  return `$${(cents / 100).toFixed(2)}/hr`;
}
