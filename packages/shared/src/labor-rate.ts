// Labor rate — the per-classification, per-rate-type hourly cost
// that the estimating module multiplies by hours to price a job's
// labor lines.
//
// Plain English: when an estimator says "8 hours of Operator Group
// 4," YGE has to know how much that costs. The rate is different by
// rate type:
//
//   - Private  — non-prevailing-wage work (commercial private jobs).
//   - PW       — California DIR prevailing wage on public works.
//                The number we pull from the DIR general
//                determinations (or its area variant).
//   - DB       — Davis-Bacon, federal prevailing wage.
//   - IBEW     — IBEW union scale, used on a small subset of jobs.
//
// Burden percent is applied on top of base — workers' comp, payroll
// taxes, GL, vacation, training. Stored as a decimal fraction
// (0.4500 = 45%).

import { z } from 'zod';

export const LaborRateTypeSchema = z.enum(['PRIVATE', 'PW', 'DB', 'IBEW']);
export type LaborRateType = z.infer<typeof LaborRateTypeSchema>;

export const LaborRateSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  /** Cost-code key (joins to CostCode.code). e.g. "LAB-OE-EXC4". */
  code: z.string().min(1).max(40),
  /** Human-readable classification, e.g. "Operator Group 4 — Excavator/Dozer". */
  classification: z.string().min(1).max(200),
  /** CA DIR area number, when the rate varies by region (1-4 typically). */
  area: z.number().int().nullable().optional(),

  /** Burden % as a decimal fraction. 0.45 = 45% (workers' comp +
   *  payroll taxes + GL + paid time off + training). */
  burdenPct: z.number().min(0).max(2),

  /** Base hourly cost (cents) for non-prevailing-wage private work. */
  baseCentsPrivate: z.number().int().nonnegative(),
  /** Base hourly cost (cents) at CA DIR prevailing wage. */
  baseCentsPW: z.number().int().nonnegative(),
  /** Base hourly cost (cents) under Davis-Bacon federal PW. */
  baseCentsDB: z.number().int().nonnegative(),
  /** Base hourly cost (cents) at IBEW union scale. Nullable —
   *  most classifications never use IBEW. */
  baseCentsIBEW: z.number().int().nonnegative().nullable().optional(),

  /** First date this rate applies. ISO date string. */
  effectiveFrom: z.string(),
  /** Last date this rate applies. Null = currently active. */
  effectiveTo: z.string().nullable().optional(),

  /** Provenance, e.g. "CA DIR 2026-01 General Determination". */
  source: z.string().max(200).nullable().optional(),

  /** Soft-delete marker. */
  deletedAt: z.string().nullable().optional(),
});
export type LaborRate = z.infer<typeof LaborRateSchema>;

// Create input — server fills id / createdAt / updatedAt.
export const LaborRateCreateSchema = z.object({
  code: z.string().min(1).max(40),
  classification: z.string().min(1).max(200),
  area: z.number().int().nullable().optional(),
  burdenPct: z.number().min(0).max(2),
  baseCentsPrivate: z.number().int().nonnegative(),
  baseCentsPW: z.number().int().nonnegative(),
  baseCentsDB: z.number().int().nonnegative(),
  baseCentsIBEW: z.number().int().nonnegative().nullable().optional(),
  effectiveFrom: z.string(),
  effectiveTo: z.string().nullable().optional(),
  source: z.string().max(200).nullable().optional(),
});
export type LaborRateCreate = z.infer<typeof LaborRateCreateSchema>;

export const LaborRatePatchSchema = LaborRateCreateSchema.partial();
export type LaborRatePatch = z.infer<typeof LaborRatePatchSchema>;

/**
 * Pick the right hourly cents for a given rate type. Returns 0 when
 * the requested type isn't priced (e.g. asking for IBEW on a class
 * that doesn't have it).
 */
export function laborRateForType(rate: LaborRate, type: LaborRateType): number {
  switch (type) {
    case 'PRIVATE': return rate.baseCentsPrivate;
    case 'PW': return rate.baseCentsPW;
    case 'DB': return rate.baseCentsDB;
    case 'IBEW': return rate.baseCentsIBEW ?? 0;
  }
}

/**
 * Compute the burdened hourly cost — base × (1 + burdenPct), rounded
 * to whole cents. This is what an estimate line should use as the
 * "cost-loaded" rate before applying the markup stack.
 */
export function laborRateBurdened(rate: LaborRate, type: LaborRateType): number {
  const base = laborRateForType(rate, type);
  return Math.round(base * (1 + rate.burdenPct));
}
