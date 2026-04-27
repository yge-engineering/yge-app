// Material slow-mover tracker.
//
// Plain English: a part that's been sitting in the yard for a year
// without anyone touching it is dead capital. The yard guy knows
// some of these intuitively ('that drum of weld rod has been in
// bin 14 since the freeway job') but management wants the list. This
// walks the per-material movement ledger, finds parts that haven't
// moved in N days, and surfaces the dollar value of the stale stock.
//
// Tier ladder (days since most recent CONSUMED or RETURNED movement,
// ignoring RECEIVED so we don't mark stuff "fresh" just because we
// bought more):
//   FRESH       <90 days
//   SLOWING     90-179
//   SLOW        180-364
//   STALE       365+
//
// Pure derivation. No persisted records.

import type { Material } from './material';

export type SlowMoverFlag = 'FRESH' | 'SLOWING' | 'SLOW' | 'STALE';

export interface SlowMoverRow {
  materialId: string;
  name: string;
  sku: string | null;
  category: Material['category'];
  unit: string;
  quantityOnHand: number;
  unitCostCents: number;
  /** quantityOnHand * unitCostCents — capital tied up. */
  inventoryValueCents: number;
  /** Most recent CONSUMED or RETURNED movement date (ISO). Null when
   *  none on file. */
  lastUsedAt: string | null;
  daysSinceLastUse: number | null;
  flag: SlowMoverFlag;
}

export interface SlowMoverRollup {
  totalParts: number;
  fresh: number;
  slowing: number;
  slow: number;
  stale: number;
  /** Sum of inventoryValueCents across SLOW + STALE — capital we
   *  could free up by clearing dead stock. */
  staleCapitalCents: number;
}

export interface SlowMoverInputs {
  asOf?: string;
  materials: Material[];
}

export function buildSlowMoverReport(inputs: SlowMoverInputs): {
  rollup: SlowMoverRollup;
  rows: SlowMoverRow[];
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const refNow = new Date(`${asOf}T00:00:00Z`);

  const rows: SlowMoverRow[] = [];
  const counts = { fresh: 0, slowing: 0, slow: 0, stale: 0 };
  let staleCapitalCents = 0;

  for (const m of inputs.materials) {
    if (m.quantityOnHand <= 0) continue; // skip empty bins

    let lastUsedAt: string | null = null;
    for (const mv of m.movements) {
      if (mv.kind !== 'CONSUMED' && mv.kind !== 'RETURNED') continue;
      if (!lastUsedAt || mv.recordedAt > lastUsedAt) {
        lastUsedAt = mv.recordedAt;
      }
    }

    const lastDate = lastUsedAt ? parseDate(lastUsedAt) : null;
    const daysSince = lastDate ? Math.max(0, daysBetween(lastDate, refNow)) : null;
    const flag = classify(daysSince);
    const unitCost = m.unitCostCents ?? 0;
    const value = Math.round(m.quantityOnHand * unitCost);

    rows.push({
      materialId: m.id,
      name: m.name,
      sku: m.sku ?? null,
      category: m.category,
      unit: m.unit,
      quantityOnHand: m.quantityOnHand,
      unitCostCents: unitCost,
      inventoryValueCents: value,
      lastUsedAt,
      daysSinceLastUse: daysSince,
      flag,
    });

    if (flag === 'FRESH') counts.fresh += 1;
    else if (flag === 'SLOWING') counts.slowing += 1;
    else if (flag === 'SLOW') counts.slow += 1;
    else counts.stale += 1;
    if (flag === 'SLOW' || flag === 'STALE') staleCapitalCents += value;
  }

  // Worst (stale, most days since last use) first.
  const tierRank: Record<SlowMoverFlag, number> = {
    STALE: 0,
    SLOW: 1,
    SLOWING: 2,
    FRESH: 3,
  };
  rows.sort((a, b) => {
    if (a.flag !== b.flag) return tierRank[a.flag] - tierRank[b.flag];
    return (b.daysSinceLastUse ?? 0) - (a.daysSinceLastUse ?? 0);
  });

  return {
    rollup: {
      totalParts: rows.length,
      fresh: counts.fresh,
      slowing: counts.slowing,
      slow: counts.slow,
      stale: counts.stale,
      staleCapitalCents,
    },
    rows,
  };
}

function classify(daysSince: number | null): SlowMoverFlag {
  if (daysSince === null) return 'STALE'; // never used, full quantity sitting
  if (daysSince < 90) return 'FRESH';
  if (daysSince < 180) return 'SLOWING';
  if (daysSince < 365) return 'SLOW';
  return 'STALE';
}

function parseDate(s: string): Date | null {
  const head = s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(head)) return null;
  const d = new Date(`${head}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}
