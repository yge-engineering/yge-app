// Per-job materials spend by category.
//
// Plain English: a job that's been running for two months has spent
// money on aggregate, asphalt, fuel, rebar, fittings, etc. Where is
// the dollar weight? When 60% of a job's material spend is fuel,
// that's a sign the job is too far from the yard or the equipment
// is running idle. When rebar is ballooning, the design changed.
// This rolls up AP material spend per job, broken out by category,
// so the project manager can see the mix.
//
// Pure derivation. Joins AP invoices to materials by AP-line
// `costCode` matching the material's category — when no costCode is
// set, falls back to 'OTHER' so nothing falls off the report.
//
// No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Material, MaterialCategory } from './material';

export interface JobMaterialSpendRow {
  jobId: string;
  totalSpendCents: number;
  /** Per-category spend, sorted desc. */
  byCategory: Array<{
    category: MaterialCategory;
    spendCents: number;
    sharePct: number;
  }>;
  /** Top single category for this job (drives the headline). */
  topCategory: MaterialCategory | null;
  topCategorySharePct: number;
  /** Number of distinct AP invoices touching this job. */
  invoiceCount: number;
}

export interface JobMaterialSpendRollup {
  jobsConsidered: number;
  totalSpendCents: number;
  byCategory: Array<{
    category: MaterialCategory;
    spendCents: number;
    sharePct: number;
  }>;
}

export interface JobMaterialSpendInputs {
  apInvoices: ApInvoice[];
  /** Optional Material lookup so we can map a costCode/sku to its
   *  category. When omitted, all spend lands in OTHER. */
  materials?: Material[];
  /** Optional yyyy-mm-dd window. */
  fromDate?: string;
  toDate?: string;
}

export function buildJobMaterialSpend(inputs: JobMaterialSpendInputs): {
  rollup: JobMaterialSpendRollup;
  rows: JobMaterialSpendRow[];
} {
  const inRange = (d: string) => {
    if (inputs.fromDate && d < inputs.fromDate) return false;
    if (inputs.toDate && d > inputs.toDate) return false;
    return true;
  };

  // Build a costCode|sku → category lookup from the materials.
  const codeToCategory = new Map<string, MaterialCategory>();
  for (const m of inputs.materials ?? []) {
    if (m.sku) codeToCategory.set(m.sku.trim().toLowerCase(), m.category);
  }

  type Bucket = {
    jobId: string;
    perCat: Map<MaterialCategory, number>;
    invoices: Set<string>;
  };
  const buckets = new Map<string, Bucket>();

  for (const inv of inputs.apInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'REJECTED') continue;
    if (!inRange(inv.invoiceDate)) continue;

    for (const li of inv.lineItems) {
      const jobId = li.jobId ?? inv.jobId;
      if (!jobId) continue;
      const cat = pickCategory(li.costCode, codeToCategory);
      const b = buckets.get(jobId) ?? {
        jobId,
        perCat: new Map<MaterialCategory, number>(),
        invoices: new Set<string>(),
      };
      b.perCat.set(cat, (b.perCat.get(cat) ?? 0) + li.lineTotalCents);
      b.invoices.add(inv.id);
      buckets.set(jobId, b);
    }
  }

  const rows: JobMaterialSpendRow[] = [];
  let grandTotal = 0;
  const grandByCat = new Map<MaterialCategory, number>();

  for (const b of buckets.values()) {
    let jobTotal = 0;
    for (const cents of b.perCat.values()) jobTotal += cents;

    const byCategory = Array.from(b.perCat.entries())
      .map(([category, cents]) => ({
        category,
        spendCents: cents,
        sharePct: jobTotal === 0 ? 0 : round4(cents / jobTotal),
      }))
      .sort((a, b) => b.spendCents - a.spendCents);

    const top = byCategory[0] ?? null;
    rows.push({
      jobId: b.jobId,
      totalSpendCents: jobTotal,
      byCategory,
      topCategory: top?.category ?? null,
      topCategorySharePct: top?.sharePct ?? 0,
      invoiceCount: b.invoices.size,
    });

    grandTotal += jobTotal;
    for (const [cat, cents] of b.perCat.entries()) {
      grandByCat.set(cat, (grandByCat.get(cat) ?? 0) + cents);
    }
  }

  // Highest-spend job first.
  rows.sort((a, b) => b.totalSpendCents - a.totalSpendCents);

  const rollupByCategory = Array.from(grandByCat.entries())
    .map(([category, cents]) => ({
      category,
      spendCents: cents,
      sharePct: grandTotal === 0 ? 0 : round4(cents / grandTotal),
    }))
    .sort((a, b) => b.spendCents - a.spendCents);

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalSpendCents: grandTotal,
      byCategory: rollupByCategory,
    },
    rows,
  };
}

function pickCategory(
  costCode: string | undefined,
  codeToCategory: Map<string, MaterialCategory>,
): MaterialCategory {
  if (!costCode) return 'OTHER';
  const key = costCode.trim().toLowerCase();
  return codeToCategory.get(key) ?? 'OTHER';
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
