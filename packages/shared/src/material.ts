// Material — a part / consumable in YGE's stockroom or yard.
//
// Phase 1 scope: per-part inventory with current quantity on hand,
// reorder point, unit cost. Stock movements (received / consumed /
// adjusted / returned) are recorded as a separate ledger so we can
// answer "where did all the rebar go?" without losing history.
//
// What this catches:
//   - 'Are we below reorder on any part?'
//   - 'How much #4 rebar is on the Sulphur Springs job?'
//   - 'When was the last time we received Caltrans-spec base rock?'
//
// Auto-decrement from AP invoice line items: when an AP invoice line
// references a materialId, the API records a CONSUMED movement and
// decrements quantityOnHand. That logic lives on the AP invoice route
// (so it's transactional with the invoice write).

import { z } from 'zod';

/** Free-form-ish category that drives the list view's grouping. */
export const MaterialCategorySchema = z.enum([
  'AGGREGATE',          // base rock, drain rock, sand
  'ASPHALT',            // mix, tack, oil
  'CONCRETE',           // ready-mix, bagged
  'REBAR',
  'PIPE',               // HDPE, RCP, PVC, copper
  'FITTING',            // ells, tees, couplers
  'GEOTEXTILE',         // fabric, geogrid
  'EROSION_CONTROL',    // straw, rolls, blankets
  'SIGN',
  'PAINT',
  'WELDING',            // rod, wire, gas
  'FUEL',               // diesel, gas, propane (track for Cat-tag IFTA)
  'LUBRICANT',
  'FASTENER',           // bolts, screws, anchors
  'SAFETY',             // cones, vests, hard hats
  'ELECTRICAL',
  'CONSUMABLE',         // small, varied
  'OTHER',
]);
export type MaterialCategory = z.infer<typeof MaterialCategorySchema>;

/** Direction of a stock movement. */
export const StockMovementKindSchema = z.enum([
  'RECEIVED',           // new stock arrived (paired with an AP invoice usually)
  'CONSUMED',           // used on a job
  'RETURNED',           // unused stock came back to the yard
  'ADJUSTED',           // physical count correction
  'TRANSFERRED',        // moved between yards / locations
]);
export type StockMovementKind = z.infer<typeof StockMovementKindSchema>;

export const StockMovementSchema = z.object({
  id: z.string().min(1),
  /** ISO timestamp the movement was recorded. */
  recordedAt: z.string(),
  kind: StockMovementKindSchema,
  /** Quantity moved. Positive number; the kind tells us which way. */
  quantity: z.number().nonnegative(),
  /** Job linkage. Required for CONSUMED + RETURNED so cost rolls into
   *  the right project. */
  jobId: z.string().max(120).optional(),
  /** AP invoice that drove this movement (for RECEIVED) — auto-set when
   *  the invoice line item references the material. */
  apInvoiceId: z.string().max(120).optional(),
  /** Free-form note. */
  note: z.string().max(500).optional(),
});
export type StockMovement = z.infer<typeof StockMovementSchema>;

export const MaterialSchema = z.object({
  /** Stable id `mat-<8hex>`. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  /** Display name. e.g. "1.5\" Class 2 Aggregate Base". */
  name: z.string().min(1).max(200),
  /** Internal SKU / part number — useful when YGE has its own scheme.
   *  Vendor SKUs go on the AP-invoice line that references the part. */
  sku: z.string().max(80).optional(),
  category: MaterialCategorySchema,
  /** Unit of measure. EA, TON, CY, LF, GAL, etc. */
  unit: z.string().min(1).max(20).default('EA'),

  /** Quantity currently on hand across all locations. Computed from the
   *  movement ledger but cached here so list pages don't have to scan
   *  the ledger on every render. */
  quantityOnHand: z.number().default(0),
  /** Below this triggers the 'reorder' flag on the list page. */
  reorderPoint: z.number().nonnegative().optional(),
  /** Last-known unit cost in cents. Used for inventory valuation +
   *  default cost on RETURNED movements. */
  unitCostCents: z.number().int().nonnegative().optional(),

  /** Where it lives. Free-form Phase 1 ('Yard - Bin 14'). Phase 4
   *  will introduce a Location master. */
  location: z.string().max(120).optional(),
  /** Preferred vendor (free-form Phase 1; Vendor master Phase 4). */
  preferredVendor: z.string().max(200).optional(),

  /** Movement ledger. Append-only. */
  movements: z.array(StockMovementSchema).default([]),

  notes: z.string().max(4_000).optional(),
});
export type Material = z.infer<typeof MaterialSchema>;

export const MaterialCreateSchema = MaterialSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  movements: z.array(StockMovementSchema).optional(),
  quantityOnHand: z.number().optional(),
});
export type MaterialCreate = z.infer<typeof MaterialCreateSchema>;

export const MaterialPatchSchema = MaterialCreateSchema.partial();
export type MaterialPatch = z.infer<typeof MaterialPatchSchema>;

/** Body for POST /api/materials/:id/movement — append a stock movement. */
export const StockMovementCreateSchema = StockMovementSchema.omit({
  id: true,
  recordedAt: true,
});
export type StockMovementCreate = z.infer<typeof StockMovementCreateSchema>;

// ---- Pure helpers --------------------------------------------------------

export function materialCategoryLabel(c: MaterialCategory): string {
  switch (c) {
    case 'AGGREGATE': return 'Aggregate';
    case 'ASPHALT': return 'Asphalt';
    case 'CONCRETE': return 'Concrete';
    case 'REBAR': return 'Rebar';
    case 'PIPE': return 'Pipe';
    case 'FITTING': return 'Fitting';
    case 'GEOTEXTILE': return 'Geotextile';
    case 'EROSION_CONTROL': return 'Erosion control';
    case 'SIGN': return 'Sign';
    case 'PAINT': return 'Paint';
    case 'WELDING': return 'Welding';
    case 'FUEL': return 'Fuel';
    case 'LUBRICANT': return 'Lubricant';
    case 'FASTENER': return 'Fastener';
    case 'SAFETY': return 'Safety';
    case 'ELECTRICAL': return 'Electrical';
    case 'CONSUMABLE': return 'Consumable';
    case 'OTHER': return 'Other';
  }
}

export function movementKindLabel(k: StockMovementKind): string {
  switch (k) {
    case 'RECEIVED': return 'Received';
    case 'CONSUMED': return 'Consumed';
    case 'RETURNED': return 'Returned';
    case 'ADJUSTED': return 'Adjusted';
    case 'TRANSFERRED': return 'Transferred';
  }
}

/** Apply a movement to a quantity-on-hand value. RECEIVED + RETURNED add;
 *  CONSUMED + TRANSFERRED subtract; ADJUSTED replaces (the quantity field
 *  is the new total). */
export function applyMovement(
  currentQuantity: number,
  movement: Pick<StockMovement, 'kind' | 'quantity'>,
): number {
  switch (movement.kind) {
    case 'RECEIVED':
    case 'RETURNED':
      return currentQuantity + movement.quantity;
    case 'CONSUMED':
    case 'TRANSFERRED':
      return Math.max(0, currentQuantity - movement.quantity);
    case 'ADJUSTED':
      return movement.quantity;
  }
}

/** Re-compute quantityOnHand from the movement ledger from scratch.
 *  Used when reconciling after a manual edit corrupted the cached
 *  field. */
export function recomputeQuantityOnHand(
  movements: StockMovement[],
): number {
  let q = 0;
  for (const m of movements) {
    q = applyMovement(q, m);
  }
  return q;
}

/** True iff the material is at or below its reorder point. Materials
 *  without a reorderPoint configured never trigger. */
export function isBelowReorder(
  material: Pick<Material, 'quantityOnHand' | 'reorderPoint'>,
): boolean {
  if (material.reorderPoint === undefined) return false;
  return material.quantityOnHand <= material.reorderPoint;
}

/** Total inventory valuation in cents. Sum across all materials of
 *  quantityOnHand * unitCostCents (skipping the ones without unit cost). */
export function inventoryValuationCents(materials: Material[]): number {
  let cents = 0;
  for (const m of materials) {
    if (m.unitCostCents === undefined) continue;
    cents += Math.max(0, Math.round(m.quantityOnHand * m.unitCostCents));
  }
  return cents;
}

export interface InventoryRollup {
  total: number;
  belowReorder: number;
  outOfStock: number;
  valuationCents: number;
  byCategory: Array<{ category: MaterialCategory; count: number }>;
}

export function computeInventoryRollup(materials: Material[]): InventoryRollup {
  let belowReorder = 0;
  let outOfStock = 0;
  const byCategoryMap = new Map<MaterialCategory, number>();
  for (const m of materials) {
    if (m.quantityOnHand <= 0) outOfStock += 1;
    if (isBelowReorder(m)) belowReorder += 1;
    byCategoryMap.set(m.category, (byCategoryMap.get(m.category) ?? 0) + 1);
  }
  return {
    total: materials.length,
    belowReorder,
    outOfStock,
    valuationCents: inventoryValuationCents(materials),
    byCategory: Array.from(byCategoryMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export function newMaterialId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `mat-${hex.padStart(8, '0')}`;
}

export function newStockMovementId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `mov-${hex.padStart(8, '0')}`;
}
