// Fixed asset register — tax-side depreciation tracking.
//
// Per the v6.3 plan, this register is kept separate from operational
// equipment data so the CPA's depreciation schedule and the field's
// service history don't fight each other. An equipment record can link to
// its fixed-asset record via `equipmentId`.
//
// Methods implemented:
//   - STRAIGHT_LINE          — (cost - salvage) / usefulLife per year
//   - MACRS_5YR              — IRS 5-year half-year convention table
//   - MACRS_7YR              — IRS 7-year half-year convention table
//   - SECTION_179            — full deductible in year 1 (assumes eligible)
//   - BONUS_DEPRECIATION     — bonus % year 1, balance straight-line over
//                              remaining useful life (default 60% for 2024;
//                              configurable per asset via `bonusPercentage`)
//
// Money is in CENTS for system-wide consistency. computeDepreciation returns
// a schedule (yearly amounts + ending book value) so the page can render the
// usual depreciation table the CPA expects.

import { z } from 'zod';

export const FixedAssetCategorySchema = z.enum([
  'HEAVY_EQUIPMENT',
  'VEHICLE',
  'TRAILER',
  'SHOP_TOOLS',
  'COMPUTER',
  'FURNITURE',
  'BUILDING',
  'LAND_IMPROVEMENT',
  'OTHER',
]);
export type FixedAssetCategory = z.infer<typeof FixedAssetCategorySchema>;

export const DepreciationMethodSchema = z.enum([
  'STRAIGHT_LINE',
  'MACRS_5YR',
  'MACRS_7YR',
  'SECTION_179',
  'BONUS_DEPRECIATION',
]);
export type DepreciationMethod = z.infer<typeof DepreciationMethodSchema>;

export const FixedAssetSchema = z.object({
  /** Stable id `fa-<8hex>`. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  name: z.string().min(1).max(200),
  category: FixedAssetCategorySchema,
  /** Optional link to an operational Equipment record. */
  equipmentId: z.string().max(120).optional(),

  /** Vendor / dealer / source of the asset. */
  vendorName: z.string().max(200).optional(),
  /** Cost basis in CENTS. */
  acquiredCostCents: z.number().int().nonnegative(),
  /** Salvage value at end of useful life in CENTS. */
  salvageValueCents: z.number().int().nonnegative().default(0),

  /** Date acquired (yyyy-mm-dd). */
  acquiredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),
  /** Date placed in service (yyyy-mm-dd) — depreciation starts here. */
  placedInServiceOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),
  /** Disposal date if disposed (yyyy-mm-dd). */
  disposedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  disposedProceedsCents: z.number().int().nonnegative().optional(),

  /** Useful life in years. Used for STRAIGHT_LINE + BONUS_DEPRECIATION
   *  remainder. Ignored for MACRS tables (they imply a life). */
  usefulLifeYears: z.number().int().min(1).max(40).default(7),

  method: DepreciationMethodSchema,
  /** Bonus % used in year 1 (0–1) when method is BONUS_DEPRECIATION.
   *  Defaults to 0.60 (2024 phase-down). Past years would use 0.80/1.00. */
  bonusPercentage: z.number().min(0).max(1).default(0.6),

  notes: z.string().max(10_000).optional(),
});
export type FixedAsset = z.infer<typeof FixedAssetSchema>;

export const FixedAssetCreateSchema = FixedAssetSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type FixedAssetCreate = z.infer<typeof FixedAssetCreateSchema>;

export const FixedAssetPatchSchema = FixedAssetCreateSchema.partial();
export type FixedAssetPatch = z.infer<typeof FixedAssetPatchSchema>;

export function newFixedAssetId(): string {
  return 'fa-' + Math.random().toString(36).slice(2, 10).padEnd(8, '0');
}

export function fixedAssetCategoryLabel(c: FixedAssetCategory): string {
  return c.replace(/_/g, ' ').toLowerCase();
}

// ---- Depreciation tables ----------------------------------------------------

/** IRS MACRS 5-year half-year convention table (percentages). */
const MACRS_5YR_TABLE = [0.2, 0.32, 0.192, 0.1152, 0.1152, 0.0576];
/** IRS MACRS 7-year half-year convention table (percentages). */
const MACRS_7YR_TABLE = [
  0.1429, 0.2449, 0.1749, 0.1249, 0.0893, 0.0892, 0.0893, 0.0446,
];

// ---- Helpers ---------------------------------------------------------------

export interface DepreciationYear {
  year: number;
  /** Depreciation taken in this year (cents). */
  depreciationCents: number;
  /** Book value at end of this year (cents). */
  endingBookValueCents: number;
}

export interface DepreciationSchedule {
  method: DepreciationMethod;
  /** Total depreciation expected over the asset's life (cents). */
  totalDepreciationCents: number;
  /** Per-year breakdown. */
  years: DepreciationYear[];
}

export function computeDepreciationSchedule(
  asset: Pick<
    FixedAsset,
    | 'acquiredCostCents'
    | 'salvageValueCents'
    | 'usefulLifeYears'
    | 'method'
    | 'bonusPercentage'
  >,
): DepreciationSchedule {
  const cost = asset.acquiredCostCents;
  const salvage = asset.salvageValueCents;
  const baseDepreciable = Math.max(0, cost - salvage);

  switch (asset.method) {
    case 'STRAIGHT_LINE': {
      const life = Math.max(1, asset.usefulLifeYears);
      const perYear = Math.round(baseDepreciable / life);
      const years: DepreciationYear[] = [];
      let book = cost;
      let totalTaken = 0;
      for (let i = 1; i <= life; i++) {
        // True-up the last year so we land exactly on salvage value.
        const remaining = baseDepreciable - totalTaken;
        const dep = i === life ? remaining : perYear;
        totalTaken += dep;
        book -= dep;
        years.push({ year: i, depreciationCents: dep, endingBookValueCents: book });
      }
      return { method: asset.method, totalDepreciationCents: totalTaken, years };
    }
    case 'MACRS_5YR':
    case 'MACRS_7YR': {
      const table = asset.method === 'MACRS_5YR' ? MACRS_5YR_TABLE : MACRS_7YR_TABLE;
      const years: DepreciationYear[] = [];
      let book = cost;
      let totalTaken = 0;
      for (let i = 0; i < table.length; i++) {
        const pct = table[i] ?? 0;
        const dep = Math.round(cost * pct);
        totalTaken += dep;
        book -= dep;
        years.push({
          year: i + 1,
          depreciationCents: dep,
          endingBookValueCents: book,
        });
      }
      return { method: asset.method, totalDepreciationCents: totalTaken, years };
    }
    case 'SECTION_179': {
      return {
        method: asset.method,
        totalDepreciationCents: baseDepreciable,
        years: [
          {
            year: 1,
            depreciationCents: baseDepreciable,
            endingBookValueCents: cost - baseDepreciable,
          },
        ],
      };
    }
    case 'BONUS_DEPRECIATION': {
      const bonus = Math.min(1, Math.max(0, asset.bonusPercentage));
      const year1Bonus = Math.round(baseDepreciable * bonus);
      const remaining = baseDepreciable - year1Bonus;
      const life = Math.max(1, asset.usefulLifeYears);
      const perYear = life > 1 ? Math.round(remaining / (life - 1)) : 0;
      const years: DepreciationYear[] = [];
      let book = cost;
      let totalTaken = 0;
      // Year 1: bonus + straight-line first slice
      const year1SL = life > 1 ? Math.min(perYear, remaining) : remaining;
      const year1Total = year1Bonus + year1SL;
      totalTaken += year1Total;
      book -= year1Total;
      years.push({
        year: 1,
        depreciationCents: year1Total,
        endingBookValueCents: book,
      });
      // Years 2..life: straight-line on remaining
      for (let i = 2; i <= life; i++) {
        const remainingBudget = baseDepreciable - totalTaken;
        const dep = i === life ? remainingBudget : Math.min(perYear, remainingBudget);
        totalTaken += dep;
        book -= dep;
        years.push({
          year: i,
          depreciationCents: dep,
          endingBookValueCents: book,
        });
      }
      return { method: asset.method, totalDepreciationCents: totalTaken, years };
    }
  }
}

/** Convenience: depreciation taken in a given year of the asset's life. */
export function depreciationForYear(
  asset: Pick<
    FixedAsset,
    'acquiredCostCents' | 'salvageValueCents' | 'usefulLifeYears' | 'method' | 'bonusPercentage'
  >,
  yearOfLife: number,
): number {
  const sched = computeDepreciationSchedule(asset);
  const y = sched.years.find((y) => y.year === yearOfLife);
  return y?.depreciationCents ?? 0;
}
