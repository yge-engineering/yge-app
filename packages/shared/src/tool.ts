// Tool — a single piece of YGE-owned power equipment, hand tool, or
// instrument that gets dispatched out to crew members.
//
// Phase 1 is "the impact-gun problem": who has tool X right now, and which
// tools does crew member Y currently have? That's three fields:
//   tool name, serial #, current assignee (an Employee id).
//
// Maintenance schedule, photos, warranty, GPS — all Phase 4 (equipment
// tracking module). Don't add them here; bolt onto a separate Equipment
// model when we get there. The shape here is deliberately tight so the
// dispatch UI stays one-screen-per-action.

import { z } from 'zod';
import { translate, SEED_DICTIONARY, type Locale } from './i18n';

/** Free-form-ish tool category — drives how the inventory page groups
 *  rows and lets the foreman search "all the chop saws". */
export const ToolCategorySchema = z.enum([
  'IMPACT_DRIVER',
  'DRILL',
  'SAW',                  // chop saw, circular, jigsaw, sawzall
  'GRINDER',
  'JACKHAMMER',
  'COMPACTOR',            // wacker, plate compactor, jumping jack
  'PRESSURE_WASHER',
  'GENERATOR',
  'PUMP',
  'SURVEY',               // total station, transit, level, GPS rover
  'METER',                // multimeter, megger, gas meter
  'WELDER',
  'TORCH',
  'AIR_COMPRESSOR',
  'NAIL_GUN',
  'OTHER',
]);
export type ToolCategory = z.infer<typeof ToolCategorySchema>;

/** Where the tool is right now. ASSIGNED requires assignedToEmployeeId.
 *  IN_SHOP / IN_YARD / OUT_FOR_REPAIR are unassigned states. */
export const ToolStatusSchema = z.enum([
  'IN_YARD',
  'IN_SHOP',
  'ASSIGNED',
  'OUT_FOR_REPAIR',
  'LOST',
  'RETIRED',
]);
export type ToolStatus = z.infer<typeof ToolStatusSchema>;

export const ToolSchema = z.object({
  /** Stable id of the form `tool-<8hex>`. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  /** Display name printed everywhere. e.g. "Milwaukee 18V Impact Driver". */
  name: z.string().min(1).max(120),
  category: ToolCategorySchema,
  /** Manufacturer + model. Optional but very useful when the foreman
   *  needs a part lookup. */
  make: z.string().max(80).optional(),
  model: z.string().max(80).optional(),
  /** Serial number — the legal identifier if a tool walks off a job. */
  serialNumber: z.string().max(80).optional(),
  /** YGE asset tag if you've stickered it. Free-form. */
  assetTag: z.string().max(60).optional(),

  status: ToolStatusSchema.default('IN_YARD'),
  /** When status === 'ASSIGNED', this is the Employee id who currently
   *  holds the tool. Cleared on return. */
  assignedToEmployeeId: z.string().max(60).optional(),
  /** ISO timestamp when the current assignment started. */
  assignedAt: z.string().max(60).optional(),

  /** Free-form internal notes — not printed on the foreman email. */
  notes: z.string().max(2_000).optional(),
});
export type Tool = z.infer<typeof ToolSchema>;

export const ToolCreateSchema = ToolSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: ToolStatusSchema.optional(),
});
export type ToolCreate = z.infer<typeof ToolCreateSchema>;

export const ToolPatchSchema = ToolCreateSchema.partial();
export type ToolPatch = z.infer<typeof ToolPatchSchema>;

/** Body for `POST /tools/:id/dispatch` — assign the tool to an employee. */
export const ToolDispatchSchema = z.object({
  assignedToEmployeeId: z.string().min(1).max(60),
});
export type ToolDispatch = z.infer<typeof ToolDispatchSchema>;

// ---- Display helpers -----------------------------------------------------

export function categoryLabel(c: ToolCategory, locale: Locale = 'en'): string {
  return translate(SEED_DICTIONARY, locale, `toolCategory.${c}`);
}

export function toolStatusLabel(s: ToolStatus, locale: Locale = 'en'): string {
  return translate(SEED_DICTIONARY, locale, `toolStatus.${s}`);
}

/** A short identifier suitable for a packing-list line: name + serial. */
export function toolIdentifier(t: Pick<Tool, 'name' | 'make' | 'model' | 'serialNumber'>): string {
  const head = [t.make, t.model].filter(Boolean).join(' ');
  const left = head ? `${t.name} (${head})` : t.name;
  return t.serialNumber ? `${left} \u2014 SN ${t.serialNumber}` : left;
}

/** New tool id — `tool-<8hex>`. */
export function newToolId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `tool-${hex.padStart(8, '0')}`;
}
