// Dispatch equipment lines by month and category.
//
// Plain English: bucket POSTED + COMPLETED dispatch equipment
// lines by (yyyy-mm of scheduledFor, EquipmentCategory) — counts
// the lines, distinct dispatch days, and distinct units used.
// Long-format. Useful for fleet seasonality (we use rollers in
// summer, plows in winter) and for the "are we deploying enough
// trucks each month" trend.
//
// Per row: month, category, lines, distinctDates, distinctUnits.
//
// Sort: month asc, category asc.
//
// Different from dispatch-equipment-category-mix (portfolio per
// category, no month axis), equipment-utilization-summary
// (portfolio bucket).
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';
import type { Equipment, EquipmentCategory } from './equipment';
import type { DispatchCategoryKey } from './dispatch-equipment-category-mix';

export interface DispatchEquipmentMonthlyRow {
  month: string;
  category: DispatchCategoryKey;
  lines: number;
  distinctDates: number;
  distinctUnits: number;
}

export interface DispatchEquipmentMonthlyRollup {
  monthsConsidered: number;
  totalLines: number;
  unknownLines: number;
}

export interface DispatchEquipmentMonthlyInputs {
  dispatches: Dispatch[];
  equipment: Equipment[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildDispatchEquipmentMonthly(
  inputs: DispatchEquipmentMonthlyInputs,
): {
  rollup: DispatchEquipmentMonthlyRollup;
  rows: DispatchEquipmentMonthlyRow[];
} {
  const categoryById = new Map<string, EquipmentCategory>();
  const categoryByName = new Map<string, EquipmentCategory>();
  for (const eq of inputs.equipment) {
    categoryById.set(eq.id, eq.category);
    categoryByName.set(eq.name.trim().toLowerCase(), eq.category);
  }

  type Acc = {
    month: string;
    category: DispatchCategoryKey;
    lines: number;
    dates: Set<string>;
    units: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const monthSet = new Set<string>();
  let totalLines = 0;
  let unknownLines = 0;

  for (const d of inputs.dispatches) {
    if (d.status !== 'POSTED' && d.status !== 'COMPLETED') continue;
    const month = d.scheduledFor.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    for (const e of d.equipment) {
      let cat: DispatchCategoryKey;
      let unitKey: string;
      if (e.equipmentId && categoryById.has(e.equipmentId)) {
        cat = categoryById.get(e.equipmentId)!;
        unitKey = `id:${e.equipmentId}`;
      } else {
        const nameKey = e.name.trim().toLowerCase();
        cat = categoryByName.get(nameKey) ?? 'UNKNOWN';
        unitKey = `name:${nameKey}`;
      }
      if (cat === 'UNKNOWN') unknownLines += 1;
      totalLines += 1;
      const accKey = `${month}|${cat}`;
      const acc = accs.get(accKey) ?? {
        month,
        category: cat,
        lines: 0,
        dates: new Set<string>(),
        units: new Set<string>(),
      };
      acc.lines += 1;
      acc.dates.add(d.scheduledFor);
      acc.units.add(unitKey);
      accs.set(accKey, acc);
      monthSet.add(month);
    }
  }

  const rows: DispatchEquipmentMonthlyRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      month: acc.month,
      category: acc.category,
      lines: acc.lines,
      distinctDates: acc.dates.size,
      distinctUnits: acc.units.size,
    });
  }

  rows.sort((a, b) => {
    if (a.month !== b.month) return a.month.localeCompare(b.month);
    return a.category.localeCompare(b.category);
  });

  return {
    rollup: {
      monthsConsidered: monthSet.size,
      totalLines,
      unknownLines,
    },
    rows,
  };
}
