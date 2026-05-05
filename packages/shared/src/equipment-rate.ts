// Equipment rate — bare-rate sheet for owned equipment + rental rate
// sheet for outside iron.
//
// Plain English: the price-per-hour (or price-per-day for rentals)
// that estimating uses to put a number on a piece of equipment in an
// estimate. Not the equipment-fleet inventory (see equipment.ts);
// just the rate book.
//
// Two kinds:
//   OWNED   — bare $/hr + GPH × fuel price + total $/hr
//   RENTAL  — daily/weekly/monthly $ from a vendor like I-5 Rentals

import { z } from 'zod';

export const EquipmentRateKindSchema = z.enum(['OWNED', 'RENTAL']);
export type EquipmentRateKind = z.infer<typeof EquipmentRateKindSchema>;

export const EquipmentRateSourceSchema = z.enum([
  'Confirmed',
  'Estimated',
  'Other',
]);
export type EquipmentRateSource = z.infer<typeof EquipmentRateSourceSchema>;

export const EquipmentRateSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  /** Cost code reference — joins to CostCode.code. */
  costCode: z.string().min(1).max(40),
  /** Display name as it appears in the rate book. */
  name: z.string().min(1).max(200),
  kind: EquipmentRateKindSchema,

  // ---- OWNED only ----
  /** Bare rate (no fuel, no operator) in cents/hr. */
  bareRateCents: z.number().int().nonnegative().optional(),
  /** Gallons per hour (for fuel cost calc). */
  gallonsPerHour: z.number().nonnegative().optional(),
  /** Fuel cost per hour in cents (computed at the rate-book's fuel
   *  price snapshot). */
  fuelCentsPerHour: z.number().int().nonnegative().optional(),
  /** Total $/hr in cents (bare + fuel). The number used in estimates. */
  totalCentsPerHour: z.number().int().nonnegative().optional(),
  /** Unit string from the Excel — usually 'hr'. */
  unit: z.string().max(20).optional(),

  // ---- RENTAL only ----
  /** Free-form vendor category, e.g. 'Excavators', 'Dozers'. */
  category: z.string().max(80).optional(),
  /** Daily rental cost in cents. */
  dailyCents: z.number().int().nonnegative().optional(),
  /** Weekly rental cost in cents. */
  weeklyCents: z.number().int().nonnegative().optional(),
  /** Monthly rental cost in cents. */
  monthlyCents: z.number().int().nonnegative().optional(),
  /** Was this rate confirmed by a vendor quote, or estimated by us? */
  source: EquipmentRateSourceSchema.optional(),

  notes: z.string().max(1_000).optional(),
});
export type EquipmentRate = z.infer<typeof EquipmentRateSchema>;

export const EquipmentRateCreateSchema = EquipmentRateSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type EquipmentRateCreate = z.infer<typeof EquipmentRateCreateSchema>;

export const EquipmentRatePatchSchema = EquipmentRateCreateSchema.partial();
export type EquipmentRatePatch = z.infer<typeof EquipmentRatePatchSchema>;

export function newEquipmentRateId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `er-${hex.padStart(8, '0')}`;
}
