// Cost code — master reference list of cost codes used across the
// company (labor, equipment, materials, subs, other).
//
// Plain English: every estimate line, AP invoice line, and time-card
// entry references one of these. The original list lives in YGE's
// Excel master and was imported via scripts/import-from-excel.py.

import { z } from 'zod';

export const CostCodeRateSourceSchema = z.enum([
  'Labor_Rates',
  'Equipment_Rates',
  'Equipment_Rental',
  'Materials',
  'Subcontractors',
  'Other',
]);
export type CostCodeRateSource = z.infer<typeof CostCodeRateSourceSchema>;

export const CostCodeSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  /** The code itself, e.g. 'LAB-L-GEN1' or 'EQP-EX-MINI'. Unique. */
  code: z.string().min(1).max(40),
  /** Free-form category as it appears in the Excel master, e.g.
   *  'Labor / Laborers' or 'Equipment / Excavators'. */
  category: z.string().max(120).optional(),
  description: z.string().max(400).optional(),
  rateSource: CostCodeRateSourceSchema.default('Other'),
});
export type CostCode = z.infer<typeof CostCodeSchema>;

export const CostCodeCreateSchema = CostCodeSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CostCodeCreate = z.infer<typeof CostCodeCreateSchema>;

export const CostCodePatchSchema = CostCodeCreateSchema.partial();
export type CostCodePatch = z.infer<typeof CostCodePatchSchema>;

export function newCostCodeId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `cc-${hex.padStart(8, '0')}`;
}
