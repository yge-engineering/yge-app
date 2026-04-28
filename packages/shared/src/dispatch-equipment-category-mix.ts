// Dispatch equipment category mix.
//
// Plain English: across every POSTED + COMPLETED dispatch, how
// many lines of each EquipmentCategory (TRUCK, EXCAVATOR,
// LOADER, BACKHOE, GRADER, ROLLER, PAVER, COMPACTOR_LARGE,
// WATER_TRUCK, SWEEPER, etc.) are getting deployed? The mix
// shows what kinds of work the fleet is actually running — and
// surfaces gaps (we keep dispatching name-only equipment that
// doesn't match any registered piece).
//
// Per row: category | "UNKNOWN", lines, distinctDispatches,
// distinctDates, distinctJobs, distinctUnits (by id when set,
// else by lowercased name), share.
//
// Sort by lines desc.
//
// Different from equipment-fleet-age (per-piece),
// equipment-dispatch-days (per-piece days),
// equipment-cost-per-day (\$/day per piece). This is the
// portfolio category breakdown.
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';
import type { Equipment, EquipmentCategory } from './equipment';

export type DispatchCategoryKey = EquipmentCategory | 'UNKNOWN';

export interface DispatchEquipmentCategoryRow {
  category: DispatchCategoryKey;
  lines: number;
  distinctDispatches: number;
  distinctDates: number;
  distinctJobs: number;
  distinctUnits: number;
  share: number;
}

export interface DispatchEquipmentCategoryRollup {
  categoriesConsidered: number;
  totalLines: number;
  unknownLines: number;
}

export interface DispatchEquipmentCategoryInputs {
  dispatches: Dispatch[];
  equipment: Equipment[];
  /** Optional yyyy-mm-dd window applied to scheduledFor. */
  fromDate?: string;
  toDate?: string;
}

export function buildDispatchEquipmentCategoryMix(
  inputs: DispatchEquipmentCategoryInputs,
): {
  rollup: DispatchEquipmentCategoryRollup;
  rows: DispatchEquipmentCategoryRow[];
} {
  const categoryById = new Map<string, EquipmentCategory>();
  const categoryByName = new Map<string, EquipmentCategory>();
  for (const eq of inputs.equipment) {
    categoryById.set(eq.id, eq.category);
    categoryByName.set(eq.name.trim().toLowerCase(), eq.category);
  }

  type Acc = {
    lines: number;
    dispatches: Set<string>;
    dates: Set<string>;
    jobs: Set<string>;
    units: Set<string>;
  };
  const accs = new Map<DispatchCategoryKey, Acc>();
  let totalLines = 0;
  let unknownLines = 0;

  for (const d of inputs.dispatches) {
    if (d.status !== 'POSTED' && d.status !== 'COMPLETED') continue;
    if (inputs.fromDate && d.scheduledFor < inputs.fromDate) continue;
    if (inputs.toDate && d.scheduledFor > inputs.toDate) continue;
    for (const e of d.equipment) {
      let cat: DispatchCategoryKey | undefined;
      let unitKey: string;
      if (e.equipmentId && categoryById.has(e.equipmentId)) {
        cat = categoryById.get(e.equipmentId);
        unitKey = `id:${e.equipmentId}`;
      } else {
        const nameKey = e.name.trim().toLowerCase();
        cat = categoryByName.get(nameKey) ?? 'UNKNOWN';
        unitKey = `name:${nameKey}`;
      }
      if (!cat) cat = 'UNKNOWN';
      totalLines += 1;
      if (cat === 'UNKNOWN') unknownLines += 1;
      const acc = accs.get(cat) ?? {
        lines: 0,
        dispatches: new Set<string>(),
        dates: new Set<string>(),
        jobs: new Set<string>(),
        units: new Set<string>(),
      };
      acc.lines += 1;
      acc.dispatches.add(d.id);
      acc.dates.add(d.scheduledFor);
      acc.jobs.add(d.jobId);
      acc.units.add(unitKey);
      accs.set(cat, acc);
    }
  }

  const rows: DispatchEquipmentCategoryRow[] = [];
  for (const [category, acc] of accs.entries()) {
    const share = totalLines === 0
      ? 0
      : Math.round((acc.lines / totalLines) * 10_000) / 10_000;
    rows.push({
      category,
      lines: acc.lines,
      distinctDispatches: acc.dispatches.size,
      distinctDates: acc.dates.size,
      distinctJobs: acc.jobs.size,
      distinctUnits: acc.units.size,
      share,
    });
  }

  rows.sort((a, b) => b.lines - a.lines);

  return {
    rollup: {
      categoriesConsidered: rows.length,
      totalLines,
      unknownLines,
    },
    rows,
  };
}
