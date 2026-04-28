// Per-job material stock consumption.
//
// Plain English: each Material in inventory carries a list of
// StockMovement records. CONSUMED movements (with jobId) are the
// actual draws against a project. Walk those for one AWARDED job
// and surface:
//   - per-material consumed quantity + cost
//   - per-category subtotals (AGGREGATE, ASPHALT, CONCRETE, etc.)
//   - total consumed cost (cents) at material.unitCostCents
//
// Material.unitCostCents is optional; missing → cost is recorded
// as 0 for that line and a unitCostMissing count surfaces in the
// rollup so the office can chase the missing rate.
//
// Different from job-material-spend (per-job AP $) and
// material-reorder (low-stock chase) — this is the inventory-side
// view of material flowing into the job from the yard.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { Material, MaterialCategory } from './material';

export interface JobStockMaterialRow {
  materialId: string;
  name: string;
  category: MaterialCategory;
  unit: string;
  consumedQuantity: number;
  unitCostCents: number | null;
  consumedCostCents: number;
}

export interface JobStockCategoryRow {
  category: MaterialCategory;
  consumedCostCents: number;
  materialCount: number;
}

export interface JobStockConsumptionRow {
  jobId: string;
  projectName: string;
  totalConsumedCostCents: number;
  /** Distinct material ids consumed against the job. */
  distinctMaterials: number;
  /** Materials with no unitCostCents — cost couldn't be computed. */
  unitCostMissingCount: number;
  byCategory: JobStockCategoryRow[];
  materials: JobStockMaterialRow[];
}

export interface JobStockConsumptionRollup {
  jobsConsidered: number;
  totalConsumedCostCents: number;
  totalUnitCostMissing: number;
}

export interface JobStockConsumptionInputs {
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  materials: Material[];
  /** Optional inclusive yyyy-mm-dd window applied to
   *  StockMovement.recordedAt (date portion). */
  fromDate?: string;
  toDate?: string;
  /** Default false — only AWARDED jobs are scored. */
  includeAllStatuses?: boolean;
}

export function buildJobStockConsumption(
  inputs: JobStockConsumptionInputs,
): {
  rollup: JobStockConsumptionRollup;
  rows: JobStockConsumptionRow[];
} {
  const includeAll = inputs.includeAllStatuses === true;

  // Pre-index per-job consumption from materials.
  type Acc = {
    byMaterial: Map<string, { qty: number; material: Material }>;
  };
  const accs = new Map<string, Acc>();

  for (const m of inputs.materials) {
    for (const mv of m.movements) {
      if (mv.kind !== 'CONSUMED') continue;
      if (!mv.jobId) continue;
      const date = mv.recordedAt.slice(0, 10);
      if (inputs.fromDate && date < inputs.fromDate) continue;
      if (inputs.toDate && date > inputs.toDate) continue;
      const acc = accs.get(mv.jobId) ?? { byMaterial: new Map() };
      const cur = acc.byMaterial.get(m.id) ?? { qty: 0, material: m };
      cur.qty += mv.quantity;
      acc.byMaterial.set(m.id, cur);
      accs.set(mv.jobId, acc);
    }
  }

  let totalCost = 0;
  let totalMissing = 0;

  const rows: JobStockConsumptionRow[] = [];
  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const acc = accs.get(j.id);
    const materials: JobStockMaterialRow[] = [];
    let jobTotal = 0;
    let missing = 0;
    const byCat = new Map<MaterialCategory, { cost: number; count: number }>();

    if (acc) {
      for (const [materialId, entry] of acc.byMaterial.entries()) {
        const m = entry.material;
        const unitCost = m.unitCostCents ?? null;
        const cost = unitCost === null ? 0 : Math.round(entry.qty * unitCost);
        if (unitCost === null) missing += 1;
        materials.push({
          materialId,
          name: m.name,
          category: m.category,
          unit: m.unit,
          consumedQuantity: round4(entry.qty),
          unitCostCents: unitCost,
          consumedCostCents: cost,
        });
        jobTotal += cost;

        const catBucket = byCat.get(m.category) ?? { cost: 0, count: 0 };
        catBucket.cost += cost;
        catBucket.count += 1;
        byCat.set(m.category, catBucket);
      }
    }

    // Sort materials by consumedCostCents desc, then by name.
    materials.sort((a, b) => {
      if (a.consumedCostCents !== b.consumedCostCents) {
        return b.consumedCostCents - a.consumedCostCents;
      }
      return a.name.localeCompare(b.name);
    });

    const categoryRows: JobStockCategoryRow[] = Array.from(byCat.entries())
      .map(([category, v]) => ({
        category,
        consumedCostCents: v.cost,
        materialCount: v.count,
      }))
      .sort((a, b) => b.consumedCostCents - a.consumedCostCents);

    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      totalConsumedCostCents: jobTotal,
      distinctMaterials: materials.length,
      unitCostMissingCount: missing,
      byCategory: categoryRows,
      materials,
    });

    totalCost += jobTotal;
    totalMissing += missing;
  }

  // Sort rows by totalConsumedCostCents desc.
  rows.sort((a, b) => b.totalConsumedCostCents - a.totalConsumedCostCents);

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalConsumedCostCents: totalCost,
      totalUnitCostMissing: totalMissing,
    },
    rows,
  };
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
