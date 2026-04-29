// Per (job, month) AP invoice spend rollup.
//
// Plain English: bucket AP invoices by (jobId, yyyy-mm of
// invoiceDate). Sums cents, counts invoices, counts distinct
// vendors, splits paid vs open. Tells YGE how the cost burn
// on each job ramped month over month.
//
// Per row: jobId, month, total, totalCents, paidCents, openCents,
// distinctVendors.
//
// Sort: jobId asc, month asc.
//
// Different from job-material-spend (categorized, no time axis),
// job-ap-pipeline (current-state pipeline buckets, no month
// axis), vendor-spend-monthly (vendor axis, no job axis),
// job-cost-breakdown (fully integrated cost report).
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';

export interface JobApSpendMonthlyRow {
  jobId: string;
  month: string;
  total: number;
  totalCents: number;
  paidCents: number;
  openCents: number;
  distinctVendors: number;
}

export interface JobApSpendMonthlyRollup {
  jobsConsidered: number;
  monthsConsidered: number;
  totalInvoices: number;
  totalCents: number;
  paidCents: number;
  openCents: number;
  unattributed: number;
}

export interface JobApSpendMonthlyInputs {
  apInvoices: ApInvoice[];
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

export function buildJobApSpendMonthly(
  inputs: JobApSpendMonthlyInputs,
): {
  rollup: JobApSpendMonthlyRollup;
  rows: JobApSpendMonthlyRow[];
} {
  type Acc = {
    jobId: string;
    month: string;
    total: number;
    totalCents: number;
    paidCents: number;
    vendors: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const jobs = new Set<string>();
  const months = new Set<string>();

  let totalInvoices = 0;
  let totalCents = 0;
  let paidCents = 0;
  let unattributed = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const inv of inputs.apInvoices) {
    const month = inv.invoiceDate.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;
    if (!inv.jobId) {
      unattributed += 1;
      continue;
    }
    const key = `${inv.jobId}__${month}`;
    let a = accs.get(key);
    if (!a) {
      a = {
        jobId: inv.jobId,
        month,
        total: 0,
        totalCents: 0,
        paidCents: 0,
        vendors: new Set(),
      };
      accs.set(key, a);
    }
    a.total += 1;
    a.totalCents += inv.totalCents ?? 0;
    a.paidCents += inv.paidCents ?? 0;
    a.vendors.add(normVendor(inv.vendorName));

    jobs.add(inv.jobId);
    months.add(month);
    totalInvoices += 1;
    totalCents += inv.totalCents ?? 0;
    paidCents += inv.paidCents ?? 0;
  }

  const rows: JobApSpendMonthlyRow[] = [...accs.values()]
    .map((a) => ({
      jobId: a.jobId,
      month: a.month,
      total: a.total,
      totalCents: a.totalCents,
      paidCents: a.paidCents,
      openCents: Math.max(0, a.totalCents - a.paidCents),
      distinctVendors: a.vendors.size,
    }))
    .sort((x, y) => {
      if (x.jobId !== y.jobId) return x.jobId.localeCompare(y.jobId);
      return x.month.localeCompare(y.month);
    });

  return {
    rollup: {
      jobsConsidered: jobs.size,
      monthsConsidered: months.size,
      totalInvoices,
      totalCents,
      paidCents,
      openCents: Math.max(0, totalCents - paidCents),
      unattributed,
    },
    rows,
  };
}
