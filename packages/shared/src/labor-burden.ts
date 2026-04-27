// Burdened labor rate — true cost per crew hour for bidding.
//
// Plain English: the DIR table tells you the base + fringe a sub
// must pay an Operating Engineer Group 1 in Shasta County. That is
// NOT what an hour of that operator actually costs YGE. On top of
// base + fringe sits a stack of payroll-driven costs:
//
//   - Employer FICA (Social Security + Medicare): 7.65% of cash wages
//   - FUTA: 0.6% on first $7,000 of each employee's wages each year
//   - SUTA (CA): 1.5%-6.2% on first $7,000; new-employer default ~3.4%
//   - Workers comp: rate per $1 of payroll, set by classification
//     (CA: heavy civil typically 8-12% for operators, 5-8% for laborers)
//   - PTO + holiday reserve: 4-8% depending on the benefit plan
//   - General overhead allocation: small + general liability split
//
// Add those to base + fringe and you get the burdened rate — the
// number to put in the bid spreadsheet, NOT the DIR base alone.
// Bidding off base + fringe is the single most common cause of a
// "we won the job and lost money" outcome in heavy civil.
//
// Phase 1 scope: a flat per-component multiplier system. Phase 2
// will add per-employee variance (a senior operator's WC rate
// differs from a junior's; FUTA caps out mid-year on full-timers,
// etc.) — the function shape stays stable.

import type { DirClassification } from './employee';

/** Per-component burden rates as fractions of (base + fringe).
 *
 *  Defaults are reasonable starting points for a CA heavy-civil
 *  contractor circa 2026; the caller should override with YGE's
 *  actual numbers (mod CAEDD letter for SUTA, the WC declaration
 *  page for the comp rate, etc.). */
export interface BurdenComponents {
  /** Employer FICA (Social Security 6.2% + Medicare 1.45%).
   *  Default: 0.0765. */
  ficaRate: number;
  /** Federal Unemployment Tax. Statutory 6%, with a 5.4% credit for
   *  states in good standing → effective 0.6% on first $7k.
   *  Default: 0.006. */
  futaRate: number;
  /** State Unemployment Tax (CA EDD). New-employer default ~3.4% on
   *  the first $7k. Established employers get an experience-rated
   *  number on their EDD letter each year. Default: 0.034. */
  sutaRate: number;
  /** Workers' compensation premium per $1 of payroll. CA heavy-civil
   *  classes vary widely. Default: 0.08 (8%). */
  workersCompRate: number;
  /** PTO + paid-holiday accrual reserve. Default: 0.04 (4%). */
  ptoReserveRate: number;
  /** General + admin allocation (general liability insurance,
   *  training fund, safety program). Default: 0.02 (2%). */
  generalOverheadRate: number;
}

export const DEFAULT_BURDEN: BurdenComponents = {
  ficaRate: 0.0765,
  futaRate: 0.006,
  sutaRate: 0.034,
  workersCompRate: 0.08,
  ptoReserveRate: 0.04,
  generalOverheadRate: 0.02,
};

export interface BurdenedRateInputs {
  /** Base hourly wage in cents/hr (e.g. from the DIR rate table). */
  baseRateCentsPerHour: number;
  /** Fringe paid to trust funds (or in cash) in cents/hr. */
  fringeCentsPerHour: number;
  /** Override any of the burden component rates. Missing keys
   *  fall back to DEFAULT_BURDEN. */
  burden?: Partial<BurdenComponents>;
}

export interface BurdenedRateBreakdown {
  /** Echo of the inputs for traceability in the output table. */
  baseRateCentsPerHour: number;
  fringeCentsPerHour: number;

  /** Per-component dollar weight at this hourly rate (cents/hr). */
  ficaCentsPerHour: number;
  futaCentsPerHour: number;
  sutaCentsPerHour: number;
  workersCompCentsPerHour: number;
  ptoReserveCentsPerHour: number;
  generalOverheadCentsPerHour: number;

  /** Sum of all burden components (cents/hr). */
  totalBurdenCentsPerHour: number;
  /** base + fringe + totalBurden — the number to plug into a bid. */
  burdenedRateCentsPerHour: number;
  /** burdenedRate / (base+fringe). 1.32 means 32% loaded. */
  burdenMultiplier: number;
}

/** Compute the fully burdened cost per crew hour for one (base, fringe)
 *  pair. */
export function computeBurdenedRate(
  inputs: BurdenedRateInputs,
): BurdenedRateBreakdown {
  const { baseRateCentsPerHour, fringeCentsPerHour } = inputs;
  const burden: BurdenComponents = {
    ...DEFAULT_BURDEN,
    ...(inputs.burden ?? {}),
  };

  // Base + fringe is the wage base every component is calibrated to.
  // (FICA/FUTA/SUTA technically apply only to cash wages, not trust
  // fringe, but Phase 1 treats them uniformly. Phase 2 splits when
  // we have payroll-run records that distinguish cash vs. trust.)
  const wageBase = baseRateCentsPerHour + fringeCentsPerHour;

  const ficaCentsPerHour = Math.round(wageBase * burden.ficaRate);
  const futaCentsPerHour = Math.round(wageBase * burden.futaRate);
  const sutaCentsPerHour = Math.round(wageBase * burden.sutaRate);
  const workersCompCentsPerHour = Math.round(wageBase * burden.workersCompRate);
  const ptoReserveCentsPerHour = Math.round(wageBase * burden.ptoReserveRate);
  const generalOverheadCentsPerHour = Math.round(
    wageBase * burden.generalOverheadRate,
  );

  const totalBurdenCentsPerHour =
    ficaCentsPerHour +
    futaCentsPerHour +
    sutaCentsPerHour +
    workersCompCentsPerHour +
    ptoReserveCentsPerHour +
    generalOverheadCentsPerHour;

  const burdenedRateCentsPerHour = wageBase + totalBurdenCentsPerHour;
  const burdenMultiplier =
    wageBase === 0 ? 0 : burdenedRateCentsPerHour / wageBase;

  return {
    baseRateCentsPerHour,
    fringeCentsPerHour,
    ficaCentsPerHour,
    futaCentsPerHour,
    sutaCentsPerHour,
    workersCompCentsPerHour,
    ptoReserveCentsPerHour,
    generalOverheadCentsPerHour,
    totalBurdenCentsPerHour,
    burdenedRateCentsPerHour,
    burdenMultiplier: round4(burdenMultiplier),
  };
}

/** Per-classification view — feed in a Map<classification, {base, fringe}>
 *  and get back a Map<classification, BurdenedRateBreakdown>. */
export function computeBurdenedRatesByClassification(
  rates: Map<DirClassification, { baseCentsPerHour: number; fringeCentsPerHour: number }>,
  burden?: Partial<BurdenComponents>,
): Map<DirClassification, BurdenedRateBreakdown> {
  const out = new Map<DirClassification, BurdenedRateBreakdown>();
  for (const [c, r] of rates) {
    out.set(
      c,
      computeBurdenedRate({
        baseRateCentsPerHour: r.baseCentsPerHour,
        fringeCentsPerHour: r.fringeCentsPerHour,
        burden,
      }),
    );
  }
  return out;
}

/** Burden one set of WORKED HOURS into a dollar cost. Useful when
 *  evaluating a bid scope: "two operators × 80 hrs × burdened rate
 *  = how much should I budget for labor on this scope?" */
export function burdenedLaborCostCents(
  hours: number,
  breakdown: Pick<BurdenedRateBreakdown, 'burdenedRateCentsPerHour'>,
): number {
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  return Math.round(hours * breakdown.burdenedRateCentsPerHour);
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
