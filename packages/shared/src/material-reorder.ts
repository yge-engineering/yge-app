// Material reorder + consumption velocity report.
//
// Plain English: every material has a reorder point. The shop wants
// a weekly list of "what's at or below reorder, what's consuming
// fastest, what'll run out before Friday." This walks the materials
// inventory and emits:
//   - quantityOnHand vs reorderPoint
//   - consumption velocity (units/day from CONSUMED movements
//     over the last `velocityWindowDays` days, default 90)
//   - daysOfStockRemaining (quantityOnHand / velocity)
//   - urgency tier
//
// Pure derivation. No persisted records.

import type { Material } from './material';

export type MaterialReorderTier =
  | 'OUT'              // quantityOnHand <= 0
  | 'BELOW_REORDER'    // <= reorderPoint
  | 'RUNWAY_LT_7D'     // velocity says <7 days of stock
  | 'OK';              // healthy

export interface MaterialReorderRow {
  materialId: string;
  name: string;
  sku?: string;
  category: Material['category'];

  quantityOnHand: number;
  reorderPoint: number | null;
  unitCostCents: number | null;
  preferredVendor?: string;

  /** Consumption velocity over the trailing window (units/day). */
  consumptionPerDay: number;
  /** Total CONSUMED units in the trailing window. */
  consumedInWindow: number;
  /** Window length in days, echoed for traceability. */
  velocityWindowDays: number;

  /** quantityOnHand / consumptionPerDay. Null when velocity is 0. */
  daysOfStockRemaining: number | null;
  /** quantityOnHand × unitCostCents (skipped when unitCost missing). */
  carryingValueCents: number;

  tier: MaterialReorderTier;
}

export interface MaterialReorderRollup {
  total: number;
  out: number;
  belowReorder: number;
  shortRunway: number;
  ok: number;
  /** Sum of carryingValueCents across rows. */
  totalCarryingValueCents: number;
}

export interface MaterialReorderInputs {
  materials: Material[];
  /** ISO yyyy-mm-dd; defaults to today (UTC). Anchors the window. */
  asOf?: string;
  /** Trailing window length for velocity. Default 90 days. */
  velocityWindowDays?: number;
}

export function buildMaterialReorderReport(
  inputs: MaterialReorderInputs,
): { rows: MaterialReorderRow[]; rollup: MaterialReorderRollup } {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const windowDays = inputs.velocityWindowDays ?? 90;

  const asOfMs = Date.parse(`${asOf}T00:00:00Z`);
  const windowStartMs = asOfMs - windowDays * 24 * 60 * 60 * 1000;

  const rows: MaterialReorderRow[] = [];

  for (const m of inputs.materials) {
    let consumed = 0;
    for (const mv of m.movements ?? []) {
      if (mv.kind !== 'CONSUMED') continue;
      const t = Date.parse(mv.recordedAt);
      if (Number.isNaN(t)) continue;
      if (t < windowStartMs || t > asOfMs) continue;
      consumed += mv.quantity;
    }
    const consumptionPerDay = windowDays === 0 ? 0 : consumed / windowDays;
    const daysOfStockRemaining =
      consumptionPerDay <= 0
        ? null
        : m.quantityOnHand / consumptionPerDay;

    let tier: MaterialReorderTier;
    if (m.quantityOnHand <= 0) {
      tier = 'OUT';
    } else if (
      typeof m.reorderPoint === 'number' &&
      m.quantityOnHand <= m.reorderPoint
    ) {
      tier = 'BELOW_REORDER';
    } else if (daysOfStockRemaining != null && daysOfStockRemaining < 7) {
      tier = 'RUNWAY_LT_7D';
    } else {
      tier = 'OK';
    }

    const carryingValueCents =
      typeof m.unitCostCents === 'number'
        ? Math.max(0, Math.round(m.quantityOnHand * m.unitCostCents))
        : 0;

    rows.push({
      materialId: m.id,
      name: m.name,
      sku: m.sku,
      category: m.category,
      quantityOnHand: m.quantityOnHand,
      reorderPoint: m.reorderPoint ?? null,
      unitCostCents: m.unitCostCents ?? null,
      preferredVendor: m.preferredVendor,
      consumptionPerDay,
      consumedInWindow: consumed,
      velocityWindowDays: windowDays,
      daysOfStockRemaining,
      carryingValueCents,
      tier,
    });
  }

  // OUT first, then BELOW_REORDER, then RUNWAY_LT_7D (smallest runway
  // first), then OK. Within OUT/BELOW, highest velocity first
  // (running-out fast).
  const tierRank: Record<MaterialReorderTier, number> = {
    OUT: 0,
    BELOW_REORDER: 1,
    RUNWAY_LT_7D: 2,
    OK: 3,
  };
  rows.sort((a, b) => {
    if (a.tier !== b.tier) return tierRank[a.tier] - tierRank[b.tier];
    if (a.tier === 'RUNWAY_LT_7D') {
      const ar = a.daysOfStockRemaining ?? Number.POSITIVE_INFINITY;
      const br = b.daysOfStockRemaining ?? Number.POSITIVE_INFINITY;
      return ar - br;
    }
    if (a.consumptionPerDay !== b.consumptionPerDay) {
      return b.consumptionPerDay - a.consumptionPerDay;
    }
    return a.name.localeCompare(b.name);
  });

  let out = 0;
  let belowReorder = 0;
  let shortRunway = 0;
  let ok = 0;
  let totalCarryingValueCents = 0;
  for (const r of rows) {
    if (r.tier === 'OUT') out += 1;
    else if (r.tier === 'BELOW_REORDER') belowReorder += 1;
    else if (r.tier === 'RUNWAY_LT_7D') shortRunway += 1;
    else ok += 1;
    totalCarryingValueCents += r.carryingValueCents;
  }

  return {
    rows,
    rollup: {
      total: rows.length,
      out,
      belowReorder,
      shortRunway,
      ok,
      totalCarryingValueCents,
    },
  };
}
