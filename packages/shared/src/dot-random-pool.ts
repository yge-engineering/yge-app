// FMCSA Part 382 random drug + alcohol testing pool.
//
// Required for any CDL operator (CMV ≥ 26,001 lb GVWR, or any vehicle
// transporting hazmat). YGE has CDL Class A operators on dump trucks +
// lowboys, so this is a real annual compliance load.
//
// What 49 CFR §382.305 requires:
//   - Annual minimum random testing rates:
//       Controlled substances: 50% of the average number of driver
//                              positions held during the calendar year.
//                              FMCSA can lower this to 25% if industry
//                              positive rate < 1% for 2 yrs running
//                              (it has been at 50% since 2020).
//       Alcohol:               10% of average positions.
//   - Selections must use a "scientifically valid method" (random number
//     generator with each driver having equal chance).
//   - Selections must be spread reasonably throughout the year (each
//     quarter ≥ 1 selection round; we'll default to quarterly).
//   - A driver MUST be returned to the pool after testing — they remain
//     eligible for re-selection.
//   - Documentation must show: pool size on selection date, who was
//     selected, when, for which test type, and the random method used.
//
// This module is the math layer only:
//   - selectRandomPool(roster, opts)  — given a roster + rates + a seeded
//                                       RNG, returns the selected driver
//                                       IDs for one selection round.
//   - computeAnnualTargets(avgPos)     — how many tests must happen this
//                                       year given the average positions.
//   - quarterlyTargetPerPeriod(...)    — how many to test per selection
//                                       round to hit the annual target.
//
// Deterministic when given a seed (so a regenerate-this-quarter call
// matches an existing record).

import { z } from 'zod';

export const DotTestTypeSchema = z.enum(['DRUG', 'ALCOHOL']);
export type DotTestType = z.infer<typeof DotTestTypeSchema>;

export const DotDriverSchema = z.object({
  /** Employee id. */
  id: z.string().min(1),
  /** Display name for the printed selection list. */
  name: z.string().min(1).max(200),
  /** True if currently CDL-active. Inactive drivers are excluded from
   *  the pool. */
  active: z.boolean().default(true),
});
export type DotDriver = z.infer<typeof DotDriverSchema>;

export interface DotAnnualTargets {
  /** Min number of drug tests required for the year. */
  drugTests: number;
  /** Min number of alcohol tests required for the year. */
  alcoholTests: number;
}

export interface DotSelectionInput {
  testType: DotTestType;
  /** How many drivers to pick this round. Use quarterlyTargetPerPeriod(). */
  selectCount: number;
  /** Seeded RNG returning [0,1). Use mulberry32 below for deterministic
   *  results from a numeric seed. */
  rng: () => number;
}

export interface DotSelectionResult {
  testType: DotTestType;
  /** Driver ids selected, sorted by name for the printable list. */
  selectedDriverIds: string[];
  /** Pool size at selection time (after filtering inactive). */
  poolSize: number;
}

// 49 CFR §382.305(b) minimums.
export const DOT_DRUG_RATE = 0.5; // 50%
export const DOT_ALCOHOL_RATE = 0.1; // 10%
export const DOT_DEFAULT_PERIODS_PER_YEAR = 4; // quarterly is standard

/** Round-up to ensure compliance — under is a violation, over isn't. */
export function computeAnnualTargets(avgDriverPositions: number): DotAnnualTargets {
  if (avgDriverPositions < 0) {
    throw new Error('avgDriverPositions must be non-negative');
  }
  return {
    drugTests: Math.ceil(avgDriverPositions * DOT_DRUG_RATE),
    alcoholTests: Math.ceil(avgDriverPositions * DOT_ALCOHOL_RATE),
  };
}

/** Divide the annual target across selection periods. Front-loads
 *  remainders so an annual round-up flows into the earliest periods. */
export function quarterlyTargetPerPeriod(
  annualTarget: number,
  periodsPerYear: number = DOT_DEFAULT_PERIODS_PER_YEAR,
  periodIndex: number = 0,
): number {
  if (periodsPerYear <= 0) throw new Error('periodsPerYear must be > 0');
  if (periodIndex < 0 || periodIndex >= periodsPerYear) {
    throw new Error('periodIndex out of range');
  }
  const base = Math.floor(annualTarget / periodsPerYear);
  const remainder = annualTarget - base * periodsPerYear;
  return base + (periodIndex < remainder ? 1 : 0);
}

/** Pick `selectCount` drivers from the active roster, using the seeded
 *  RNG so results are reproducible. Each driver has equal probability;
 *  selection is without replacement WITHIN a single call. */
export function selectRandomPool(
  roster: DotDriver[],
  opts: DotSelectionInput,
): DotSelectionResult {
  const pool = roster.filter((d) => d.active);
  if (opts.selectCount < 0) throw new Error('selectCount must be non-negative');
  if (opts.selectCount > pool.length) {
    throw new Error(
      `selectCount ${opts.selectCount} exceeds active pool size ${pool.length}`,
    );
  }
  // Fisher-Yates partial shuffle: produces a uniformly random sample of
  // size selectCount, deterministic given the rng seed.
  const indices = pool.map((_, i) => i);
  for (let i = 0; i < opts.selectCount; i++) {
    const j = i + Math.floor(opts.rng() * (indices.length - i));
    [indices[i], indices[j]] = [indices[j]!, indices[i]!];
  }
  const selected = indices.slice(0, opts.selectCount).map((i) => pool[i]!);
  // Sort by name for the printable selection sheet.
  selected.sort((a, b) => a.name.localeCompare(b.name));
  return {
    testType: opts.testType,
    selectedDriverIds: selected.map((d) => d.id),
    poolSize: pool.length,
  };
}

/** Deterministic seeded RNG — Mulberry32. Caller hashes their seed
 *  string (e.g. `"2026Q2-DRUG"`) into a number, passes it here. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Quick + deterministic string-to-32-bit-int hash (xfnv1a). Use to feed
 *  mulberry32 from a human-readable seed like `"2026Q2-DRUG"`. */
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
