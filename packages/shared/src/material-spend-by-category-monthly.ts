// Per (material category, month) AP spend rollup.
//
// Plain English: walk every AP invoice line, look up the
// material whose category matches the line's costCode, and
// bucket by (MaterialCategory, yyyy-mm of invoiceDate).
// Tracks where the dollar weight is going month over month —
// "fuel jumped 40% in May, what changed?"
//
// Lines whose costCode doesn't match a known material category
// fall to OTHER so nothing slips off the report.
//
// Per row: category, month, lines, totalCents, distinctVendors,
// distinctJobs.
//
// Sort: month asc, totalCents desc within month.
//
// Different from job-material-spend (per-job, no time axis),
// vendor-spend-monthly (per vendor, no category), expense-by-
// category-monthly (employee-side expenses, not AP material).
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Material, MaterialCategory } from './material';

export interface MaterialSpendByCategoryMonthlyRow {
  category: MaterialCategory | 'OTHER';
  month: string;
  lines: number;
  totalCents: number;
  distinctVendors: number;
  distinctJobs: number;
}

export interface MaterialSpendByCategoryMonthlyRollup {
  categoriesConsidered: number;
  monthsConsidered: number;
  totalLines: number;
  totalCents: number;
}

export interface MaterialSpendByCategoryMonthlyInputs {
  apInvoices: ApInvoice[];
  materials: Material[];
  /** Optional yyyy-mm bounds inclusive applied to invoiceDate. */
  fromMonth?: string;
  toMonth?: string;
}

function normVendor(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(llc|inc|corp|co|ltd|company)\b/g, '')
    .replace(/[.,&'()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildMaterialSpendByCategoryMonthly(
  inputs: MaterialSpendByCategoryMonthlyInputs,
): {
  rollup: MaterialSpendByCategoryMonthlyRollup;
  rows: MaterialSpendByCategoryMonthlyRow[];
} {
  // Build a costCode → MaterialCategory lookup. Most yards keep
  // costCode aligned to category names, so the lookup is cheap.
  const codeToCategory = new Map<string, MaterialCategory>();
  for (const m of inputs.materials) {
    if (m.category) codeToCategory.set(m.category, m.category);
  }

  type Acc = {
    category: MaterialCategory | 'OTHER';
    month: string;
    lines: number;
    totalCents: number;
    vendors: Set<string>;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const cats = new Set<string>();
  const months = new Set<string>();

  let totalLines = 0;
  let totalCents = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const inv of inputs.apInvoices) {
    const month = inv.invoiceDate.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    for (const line of inv.lineItems ?? []) {
      const cat: MaterialCategory | 'OTHER' = line.costCode
        ? codeToCategory.get(line.costCode) ?? 'OTHER'
        : 'OTHER';

      const key = `${cat}__${month}`;
      let a = accs.get(key);
      if (!a) {
        a = {
          category: cat,
          month,
          lines: 0,
          totalCents: 0,
          vendors: new Set(),
          jobs: new Set(),
        };
        accs.set(key, a);
      }
      a.lines += 1;
      a.totalCents += line.lineTotalCents ?? 0;
      a.vendors.add(normVendor(inv.vendorName));
      const jobId = line.jobId ?? inv.jobId;
      if (jobId) a.jobs.add(jobId);

      cats.add(cat);
      months.add(month);
      totalLines += 1;
      totalCents += line.lineTotalCents ?? 0;
    }
  }

  const rows: MaterialSpendByCategoryMonthlyRow[] = [...accs.values()]
    .map((a) => ({
      category: a.category,
      month: a.month,
      lines: a.lines,
      totalCents: a.totalCents,
      distinctVendors: a.vendors.size,
      distinctJobs: a.jobs.size,
    }))
    .sort((x, y) => {
      if (x.month !== y.month) return x.month.localeCompare(y.month);
      return y.totalCents - x.totalCents;
    });

  return {
    rollup: {
      categoriesConsidered: cats.size,
      monthsConsidered: months.size,
      totalLines,
      totalCents,
    },
    rows,
  };
}
