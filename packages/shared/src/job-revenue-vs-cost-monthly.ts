// Per (job, month) revenue vs cost rollup.
//
// Plain English: per-job version of customer-revenue-vs-cost-
// monthly. AR billing on the job, minus AP cost incurred + any
// reimbursable expenses cost-coded to the job, all bucketed by
// yyyy-mm. Drives the per-project monthly P&L card.
//
// Per row: jobId, month, billedCents, costCents, marginCents,
// marginPct (null when billed=0).
//
// Sort: jobId asc, month asc.
//
// Different from job-ar-billing-monthly (AR only),
// job-ap-spend-monthly (AP only), job-cash-net-monthly (cash
// basis), customer-revenue-vs-cost-monthly (per customer).
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { ArInvoice } from './ar-invoice';
import type { Expense } from './expense';

export interface JobRevenueVsCostMonthlyRow {
  jobId: string;
  month: string;
  billedCents: number;
  costCents: number;
  marginCents: number;
  marginPct: number | null;
}

export interface JobRevenueVsCostMonthlyRollup {
  jobsConsidered: number;
  monthsConsidered: number;
  billedCents: number;
  costCents: number;
  marginCents: number;
  unattributed: number;
}

export interface JobRevenueVsCostMonthlyInputs {
  arInvoices: ArInvoice[];
  apInvoices: ApInvoice[];
  expenses: Expense[];
  /** Optional yyyy-mm bounds inclusive applied to invoiceDate / receiptDate. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildJobRevenueVsCostMonthly(
  inputs: JobRevenueVsCostMonthlyInputs,
): {
  rollup: JobRevenueVsCostMonthlyRollup;
  rows: JobRevenueVsCostMonthlyRow[];
} {
  type Acc = {
    jobId: string;
    month: string;
    billedCents: number;
    costCents: number;
  };
  const accs = new Map<string, Acc>();
  const jobs = new Set<string>();
  const months = new Set<string>();

  let billedCents = 0;
  let costCents = 0;
  let unattributed = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  function bump(
    jobId: string,
    month: string,
    field: 'billedCents' | 'costCents',
    cents: number,
  ): void {
    const key = `${jobId}__${month}`;
    let a = accs.get(key);
    if (!a) {
      a = { jobId, month, billedCents: 0, costCents: 0 };
      accs.set(key, a);
    }
    a[field] += cents;
    jobs.add(jobId);
    months.add(month);
  }

  for (const inv of inputs.arInvoices) {
    const month = inv.invoiceDate.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;
    bump(inv.jobId, month, 'billedCents', inv.totalCents ?? 0);
    billedCents += inv.totalCents ?? 0;
  }

  for (const inv of inputs.apInvoices) {
    const month = inv.invoiceDate.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;
    if (!inv.jobId) {
      unattributed += 1;
      continue;
    }
    bump(inv.jobId, month, 'costCents', inv.totalCents ?? 0);
    costCents += inv.totalCents ?? 0;
  }

  for (const e of inputs.expenses) {
    const month = e.receiptDate.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;
    if (!e.jobId) {
      unattributed += 1;
      continue;
    }
    bump(e.jobId, month, 'costCents', e.amountCents);
    costCents += e.amountCents;
  }

  const rows: JobRevenueVsCostMonthlyRow[] = [...accs.values()]
    .map((a) => {
      const margin = a.billedCents - a.costCents;
      const pct = a.billedCents > 0 ? margin / a.billedCents : null;
      return {
        jobId: a.jobId,
        month: a.month,
        billedCents: a.billedCents,
        costCents: a.costCents,
        marginCents: margin,
        marginPct: pct,
      };
    })
    .sort((x, y) => {
      if (x.jobId !== y.jobId) return x.jobId.localeCompare(y.jobId);
      return x.month.localeCompare(y.month);
    });

  return {
    rollup: {
      jobsConsidered: jobs.size,
      monthsConsidered: months.size,
      billedCents,
      costCents,
      marginCents: billedCents - costCents,
      unattributed,
    },
    rows,
  };
}
