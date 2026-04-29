// Per (job, equipment category) dispatch lines.
//
// Plain English: bucket dispatch equipment lines by (jobId,
// EquipmentCategory). Useful for "which jobs are eating the
// most truck-days vs excavator-days" mix view.
//
// Per row: jobId, category, lines, distinctDates, distinctUnits.
//
// Sort: jobId asc, lines desc within job.
//
// Different from dispatch-equipment-category-mix (portfolio per
// category), job-equipment-monthly (per (job, month)).
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';
import type { Equipment, EquipmentCategory } from './equipment';
import type { DispatchCategoryKey } from './dispatch-equipment-category-mix';

export interface DispatchByJobEquipmentCategoryRow {
  jobId: string;
  category: DispatchCategoryKey;
  lines: number;
  distinctDates: number;
  distinctUnits: number;
}

export interface DispatchByJobEquipmentCategoryRollup {
  jobsConsidered: number;
  categoriesConsidered: number;
  totalLines: number;
  unknownLines: number;
}

export interface DispatchByJobEquipmentCategoryInputs {
  dispatches: Dispatch[];
  equipment: Equipment[];
  /** Optional yyyy-mm-dd window applied to scheduledFor. */
  fromDate?: string;
  toDate?: string;
}

export function buildDispatchByJobEquipmentCategory(
  inputs: DispatchByJobEquipmentCategoryInputs,
): {
  rollup: DispatchByJobEquipmentCategoryRollup;
  rows: DispatchByJobEquipmentCategoryRow[];
} {
  const categoryById = new Map<string, EquipmentCategory>();
  const categoryByName = new Map<string, EquipmentCategory>();
  for (const eq of inputs.equipment) {
    categoryById.set(eq.id, eq.category);
    categoryByName.set(eq.name.trim().toLowerCase(), eq.category);
  }

  type Acc = {
    jobId: string;
    category: DispatchCategoryKey;
    lines: number;
    dates: Set<string>;
    units: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const jobSet = new Set<string>();
  const catSet = new Set<DispatchCategoryKey>();
  let totalLines = 0;
  let unknownLines = 0;

  for (const d of inputs.dispatches) {
    if (d.status !== 'POSTED' && d.status !== 'COMPLETED') continue;
    if (inputs.fromDate && d.scheduledFor < inputs.fromDate) continue;
    if (inputs.toDate && d.scheduledFor > inputs.toDate) continue;
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
      const accKey = `${d.jobId}|${cat}`;
      const acc = accs.get(accKey) ?? {
        jobId: d.jobId,
        category: cat,
        lines: 0,
        dates: new Set<string>(),
        units: new Set<string>(),
      };
      acc.lines += 1;
      acc.dates.add(d.scheduledFor);
      acc.units.add(unitKey);
      accs.set(accKey, acc);
      jobSet.add(d.jobId);
      catSet.add(cat);
    }
  }

  const rows: DispatchByJobEquipmentCategoryRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      jobId: acc.jobId,
      category: acc.category,
      lines: acc.lines,
      distinctDates: acc.dates.size,
      distinctUnits: acc.units.size,
    });
  }

  rows.sort((a, b) => {
    if (a.jobId !== b.jobId) return a.jobId.localeCompare(b.jobId);
    return b.lines - a.lines;
  });

  return {
    rollup: {
      jobsConsidered: jobSet.size,
      categoriesConsidered: catSet.size,
      totalLines,
      unknownLines,
    },
    rows,
  };
}
