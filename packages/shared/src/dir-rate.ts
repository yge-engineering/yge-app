// DIR prevailing wage rate.
//
// California Department of Industrial Relations publishes a "general
// prevailing wage determination" twice a year (typically Feb 22 +
// Aug 22) for every craft + locality. Public-works contracts must
// pay the higher of:
//   (a) the rate in effect at the bid advertise date, OR
//   (b) the rate the contract specifies if it pulls from a single
//       semi-annual issue.
//
// The wage breaks down into:
//   - basic hourly rate
//   - health & welfare
//   - pension
//   - vacation/holiday
//   - training
//   - other (subsistence, travel)
//
// Total fringe = H&W + pension + vacation + training + other.
// Total prevailing rate = basic + total fringe.
//
// Phase 1 stores a static set of records keyed by (classification,
// county, effectiveDate). Phase 2 will scrape the DIR site on a
// schedule.

import { z } from 'zod';
import { DirClassificationSchema, type DirClassification } from './employee';

export const DirRateSchema = z.object({
  /** Stable id `dir-<8hex>`. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  classification: DirClassificationSchema,
  /** California county or "STATEWIDE" for crafts with a uniform
   *  statewide rate. */
  county: z.string().min(1).max(80),
  /** Date this determination becomes effective (yyyy-mm-dd). */
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),
  /** Date the determination is superseded — null if currently in
   *  effect. (yyyy-mm-dd) */
  expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd').optional(),

  /** Basic hourly rate in cents (e.g. $58.71 = 5871). */
  basicHourlyCents: z.number().int().nonnegative(),
  /** Health & welfare fringe, cents/hr. */
  healthAndWelfareCents: z.number().int().nonnegative().default(0),
  /** Pension fringe, cents/hr. */
  pensionCents: z.number().int().nonnegative().default(0),
  /** Vacation / holiday fringe, cents/hr. */
  vacationHolidayCents: z.number().int().nonnegative().default(0),
  /** Training fringe, cents/hr. */
  trainingCents: z.number().int().nonnegative().default(0),
  /** Other fringe (travel, subsistence). cents/hr. */
  otherFringeCents: z.number().int().nonnegative().default(0),

  /** Free-form notes — overtime multiplier, double-time threshold,
   *  shift differential, etc. */
  notes: z.string().max(10_000).optional(),
  /** DIR's official document URL for traceability. */
  sourceUrl: z.string().max(800).optional(),
});
export type DirRate = z.infer<typeof DirRateSchema>;

export const DirRateCreateSchema = DirRateSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  healthAndWelfareCents: z.number().int().nonnegative().optional(),
  pensionCents: z.number().int().nonnegative().optional(),
  vacationHolidayCents: z.number().int().nonnegative().optional(),
  trainingCents: z.number().int().nonnegative().optional(),
  otherFringeCents: z.number().int().nonnegative().optional(),
});
export type DirRateCreate = z.infer<typeof DirRateCreateSchema>;

export const DirRatePatchSchema = DirRateCreateSchema.partial();
export type DirRatePatch = z.infer<typeof DirRatePatchSchema>;

// ---- Helpers -------------------------------------------------------------

/** Sum of all fringe components, cents/hr. */
export function totalFringeCents(rate: Pick<DirRate,
  | 'healthAndWelfareCents'
  | 'pensionCents'
  | 'vacationHolidayCents'
  | 'trainingCents'
  | 'otherFringeCents'>): number {
  return (
    rate.healthAndWelfareCents +
    rate.pensionCents +
    rate.vacationHolidayCents +
    rate.trainingCents +
    rate.otherFringeCents
  );
}

/** Total prevailing wage = basic + all fringe (cents/hr). */
export function totalPrevailingWageCents(rate: Pick<DirRate,
  | 'basicHourlyCents'
  | 'healthAndWelfareCents'
  | 'pensionCents'
  | 'vacationHolidayCents'
  | 'trainingCents'
  | 'otherFringeCents'>): number {
  return rate.basicHourlyCents + totalFringeCents(rate);
}

/**
 * Find the rate in effect for a (classification, county, date) triple.
 *
 * Resolution order:
 *   1) exact county match where date is within [effectiveDate, expiresOn?]
 *   2) STATEWIDE rate where date is within range
 *   3) most recent rate for that (classification, county) pair
 *      regardless of date
 *
 * Returns null if no rate matches.
 */
export function findRateInEffect(
  rates: DirRate[],
  args: {
    classification: DirClassification;
    county: string;
    asOf: string; // yyyy-mm-dd
  },
): DirRate | null {
  const { classification, county, asOf } = args;
  const matches = rates.filter((r) => r.classification === classification);
  if (matches.length === 0) return null;

  const inRange = (r: DirRate) =>
    r.effectiveDate <= asOf && (!r.expiresOn || r.expiresOn >= asOf);

  // 1) county match in date range
  const exact = matches.filter((r) => r.county === county && inRange(r));
  if (exact.length > 0) {
    exact.sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
    return exact[0]!;
  }

  // 2) STATEWIDE in date range
  const statewide = matches.filter((r) => r.county === 'STATEWIDE' && inRange(r));
  if (statewide.length > 0) {
    statewide.sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
    return statewide[0]!;
  }

  // 3) most recent for that (classification, county)
  const sameCounty = matches.filter((r) => r.county === county);
  if (sameCounty.length > 0) {
    sameCounty.sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
    return sameCounty[0]!;
  }

  return null;
}

export interface DirRateRollup {
  total: number;
  classifications: number;
  counties: number;
  /** Number of currently-active determinations (no expiresOn or
   *  expiresOn >= today). */
  activeToday: number;
  /** Newest effective date in the set. */
  newestEffectiveDate: string | null;
}

export function computeDirRateRollup(rates: DirRate[]): DirRateRollup {
  const today = new Date().toISOString().slice(0, 10);
  const classifications = new Set<string>();
  const counties = new Set<string>();
  let activeToday = 0;
  let newestEffectiveDate: string | null = null;
  for (const r of rates) {
    classifications.add(r.classification);
    counties.add(r.county);
    if (r.effectiveDate <= today && (!r.expiresOn || r.expiresOn >= today)) {
      activeToday += 1;
    }
    if (!newestEffectiveDate || r.effectiveDate > newestEffectiveDate) {
      newestEffectiveDate = r.effectiveDate;
    }
  }
  return {
    total: rates.length,
    classifications: classifications.size,
    counties: counties.size,
    activeToday,
    newestEffectiveDate,
  };
}

export function newDirRateId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `dir-${hex.padStart(8, '0')}`;
}
