// Equipment parts catalog + heuristic classifier.
//
// Per the v6.3 gap analysis (Phase 3): "Parts inventory intake
// (Cat/Komatsu/NAPA/Ferguson invoice parser → inventory)" was
// unbuilt. Material.ts handles construction materials (aggregate,
// asphalt, fittings, etc.); this module handles the DIFFERENT
// domain of equipment-maintenance PARTS — filters, fluids, belts,
// hoses, GET (ground-engaging tools), tires, gaskets, bearings, etc.
//
// Why a separate model:
//   - Different vocabulary (CAT 1R-0750 oil filter vs. 3/4-in. drain
//     rock).
//   - Different unit-of-measure conventions (EA / QT / GAL vs. TON /
//     CY / LF).
//   - Different procurement vendors (NAPA, Ferguson, Cat, Komatsu,
//     local-yard dealer) vs. material vendors (Tehama Rock, Hat
//     Creek Construction Materials, etc.).
//   - Different consumption pattern (per-equipment service interval
//     vs. per-job draw).
//
// This bundle is the schema + the heuristic classifier. Future
// bundles add the inventory store, the AP-invoice → parts intake
// pipeline, and an AI parts-classifier prompt that fills in the gaps
// the heuristic doesn't catch.

import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const EquipmentPartCategorySchema = z.enum([
  // Filters
  'FILTER_OIL',
  'FILTER_AIR',
  'FILTER_FUEL',
  'FILTER_HYDRAULIC',
  'FILTER_CABIN',
  // Fluids
  'FLUID_ENGINE_OIL',
  'FLUID_HYDRAULIC',
  'FLUID_TRANSMISSION',
  'FLUID_COOLANT',
  'FLUID_GREASE',
  'FLUID_DEF', // diesel exhaust fluid
  // Belts + hoses
  'BELT_DRIVE',
  'BELT_TIMING',
  'HOSE_HYDRAULIC',
  'HOSE_RADIATOR',
  'HOSE_FUEL',
  // Electrical
  'ELECTRICAL_BATTERY',
  'ELECTRICAL_BULB',
  'ELECTRICAL_SWITCH',
  // GET — ground-engaging tools
  'GET_TEETH',
  'GET_CUTTING_EDGE',
  'GET_BUSHING_PIN',
  'GET_TRACK_PAD',
  // Other
  'TIRE',
  'GASKET_SEAL',
  'BEARING',
  'FASTENER',
  'CONSUMABLE', // shop-rag, brake-clean, sandpaper
  'OTHER',
]);
export type EquipmentPartCategory = z.infer<typeof EquipmentPartCategorySchema>;

export const EquipmentPartSchema = z.object({
  id: z.string().min(1),
  /** Internal SKU or shelf label. */
  internalSku: z.string().max(80).optional(),
  /** Free-form manufacturer name. */
  manufacturer: z.string().max(120).optional(),
  /** Manufacturer's part number — primary external identifier. */
  manufacturerPartNumber: z.string().max(120).optional(),
  description: z.string().min(1).max(300),
  category: EquipmentPartCategorySchema,
  /** Equipment ids this part fits. Empty = generic. */
  fitsEquipmentIds: z.array(z.string().min(1)).default([]),
  /** Unit of measure (EA / QT / GAL / LB / FT / etc.). */
  unitOfMeasure: z.string().min(1).max(20).default('EA'),
  /** Most-recent price in cents per unit. Optional — first purchase
   *  populates it. */
  lastPriceCents: z.number().int().nonnegative().optional(),
  lastPurchasedOn: z.string().regex(ISO_DATE).optional(),
  /** Per-location stock par level — alert when on-hand drops below. */
  parLevel: z.number().nonnegative().optional(),
});
export type EquipmentPart = z.infer<typeof EquipmentPartSchema>;

export const EquipmentPartInventorySchema = z.object({
  partId: z.string().min(1),
  /** Yard / truck / location id. */
  locationId: z.string().min(1).max(60),
  onHandQty: z.number().nonnegative(),
  asOfDate: z.string().regex(ISO_DATE),
});
export type EquipmentPartInventory = z.infer<typeof EquipmentPartInventorySchema>;

// ---- Heuristic classifier -------------------------------------------------

interface CategoryHint {
  category: EquipmentPartCategory;
  /** Lowercased substrings that strongly indicate this category. */
  patterns: string[];
}

// Order matters — first match wins, so put the most-specific hints
// first. The classifier is greedy + conservative: when nothing
// matches it returns 'OTHER' so a future AI pass can re-classify.
const HINTS: CategoryHint[] = [
  // Filters — check before fluids so "oil filter" doesn't match FLUID_ENGINE_OIL.
  { category: 'FILTER_OIL', patterns: ['oil filter', 'oil fltr', 'spin-on oil'] },
  { category: 'FILTER_AIR', patterns: ['air filter', 'air fltr', 'air cleaner element'] },
  { category: 'FILTER_FUEL', patterns: ['fuel filter', 'fuel fltr', 'fuel/water separator'] },
  { category: 'FILTER_HYDRAULIC', patterns: ['hydraulic filter', 'hyd filter', 'hyd fltr'] },
  { category: 'FILTER_CABIN', patterns: ['cabin filter', 'hvac filter', 'cab filter'] },
  // Fluids
  { category: 'FLUID_ENGINE_OIL', patterns: ['engine oil', '15w40', '15w-40', '10w30', 'sae 30'] },
  { category: 'FLUID_HYDRAULIC', patterns: ['hydraulic oil', 'hyd oil', 'aw46', 'aw 46', 'iso 46'] },
  { category: 'FLUID_TRANSMISSION', patterns: ['transmission fluid', 'atf', 'gear oil', 'final drive oil'] },
  { category: 'FLUID_COOLANT', patterns: ['coolant', 'antifreeze', 'eg-50', 'glycol'] },
  { category: 'FLUID_GREASE', patterns: ['grease', 'moly grease', 'ep-2'] },
  { category: 'FLUID_DEF', patterns: ['diesel exhaust fluid', 'def ', 'def fluid', 'adblue'] },
  // Belts + hoses
  { category: 'BELT_DRIVE', patterns: ['drive belt', 'serpentine', 'v-belt'] },
  { category: 'BELT_TIMING', patterns: ['timing belt'] },
  { category: 'HOSE_HYDRAULIC', patterns: ['hydraulic hose', 'hyd hose'] },
  { category: 'HOSE_RADIATOR', patterns: ['radiator hose', 'rad hose'] },
  { category: 'HOSE_FUEL', patterns: ['fuel hose', 'fuel line'] },
  // Electrical
  { category: 'ELECTRICAL_BATTERY', patterns: ['battery', 'group 31', 'cca'] },
  { category: 'ELECTRICAL_BULB', patterns: ['headlight', 'tail light', 'bulb', 'led work light'] },
  { category: 'ELECTRICAL_SWITCH', patterns: ['switch', 'solenoid', 'relay'] },
  // GET
  { category: 'GET_TEETH', patterns: ['bucket tooth', 'bucket teeth', 'tooth point'] },
  { category: 'GET_CUTTING_EDGE', patterns: ['cutting edge', 'end bit', 'side cutter'] },
  { category: 'GET_BUSHING_PIN', patterns: ['bushing', 'pin kit', 'bucket pin'] },
  { category: 'GET_TRACK_PAD', patterns: ['track pad', 'rubber pad', 'track shoe'] },
  // Other
  { category: 'TIRE', patterns: ['tire', 'tyre'] },
  { category: 'GASKET_SEAL', patterns: ['gasket', 'seal', 'o-ring', 'oring'] },
  { category: 'BEARING', patterns: ['bearing', 'roller brg'] },
  { category: 'FASTENER', patterns: ['bolt', 'nut', 'washer', 'screw', 'cap screw'] },
  { category: 'CONSUMABLE', patterns: ['shop rag', 'brake clean', 'sandpaper', 'wd-40', 'wd40'] },
];

/** Best-guess category from the description.
 *  Returns 'OTHER' when nothing matches — caller may run AI second pass. */
export function classifyPart(
  description: string,
  manufacturer?: string,
): EquipmentPartCategory {
  const hay = `${description ?? ''} ${manufacturer ?? ''}`.toLowerCase();
  for (const h of HINTS) {
    for (const p of h.patterns) {
      if (hay.includes(p)) return h.category;
    }
  }
  return 'OTHER';
}

/** Returns true when stock at a location is at or below par. */
export function isBelowPar(
  part: Pick<EquipmentPart, 'parLevel'>,
  inv: Pick<EquipmentPartInventory, 'onHandQty'>,
): boolean {
  if (part.parLevel === undefined) return false;
  return inv.onHandQty <= part.parLevel;
}

/** Rolls up shop-side reorder list (parts at or below par, sorted by
 *  most-urgent-first measured as parLevel - onHand). */
export function reorderList(
  parts: EquipmentPart[],
  inventories: EquipmentPartInventory[],
): Array<{
  part: EquipmentPart;
  inventory: EquipmentPartInventory;
  shortBy: number;
}> {
  const partById = new Map(parts.map((p) => [p.id, p]));
  const rows: Array<{
    part: EquipmentPart;
    inventory: EquipmentPartInventory;
    shortBy: number;
  }> = [];
  for (const inv of inventories) {
    const part = partById.get(inv.partId);
    if (!part) continue;
    if (!isBelowPar(part, inv)) continue;
    const par = part.parLevel ?? 0;
    rows.push({ part, inventory: inv, shortBy: round2(par - inv.onHandQty) });
  }
  rows.sort((a, b) => b.shortBy - a.shortBy);
  return rows;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
