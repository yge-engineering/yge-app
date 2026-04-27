// Per-job profitability roll-up.
//
// Pure derivation. For each job, joins all AR invoices, AR payments,
// AP invoices, change orders, and (when present) reimbursable expense
// + mileage entries to produce:
//
//   Revenue  = sum of AR invoice totals (sent / partially paid / paid)
//   Costs    = sum of approved + paid AP invoices coded to the job
//            + sum of reimbursable expenses coded to the job
//   GP       = Revenue − Costs
//   Margin % = GP / Revenue
//
// CO totals + retention are surfaced separately so Brook can see how
// the contract has shifted.

import type { ApInvoice } from './ap-invoice';
import type { ArInvoice } from './ar-invoice';
import { arUnpaidBalanceCents } from './ar-invoice';
import type { ChangeOrder } from './change-order';
import type { Expense } from './expense';
import { expenseReimbursableCents } from './expense';
import type { Job } from './job';
import type { MileageEntry } from './mileage';
import { reimbursementCents } from './mileage';

export interface JobProfitCostByCategory {
  /** AP-invoice job costs (vendor bills coded to this job, approved or paid). */
  apCents: number;
  /** Out-of-pocket expense receipts coded to this job. */
  expenseCents: number;
  /** Personal-vehicle mileage reimbursement coded to this job. */
  mileageCents: number;
}

export interface JobProfitRow {
  jobId: string;
  projectName: string;
  status: Job['status'];

  /** Sum of AR invoices' totalCents (excludes drafts). */
  revenueBilledCents: number;
  /** Sum of unpaid balances on AR invoices. Outstanding receivable. */
  revenueOutstandingCents: number;

  /** Approved + executed change-order total impact. */
  changeOrderTotalCents: number;

  costsByCategory: JobProfitCostByCategory;
  /** Total costs across all categories. */
  totalCostsCents: number;

  /** Gross profit = revenue billed − total costs. */
  grossProfitCents: number;
  /** Gross margin as a fraction (0..1). 0 when revenue is 0. */
  grossMargin: number;
}

export interface JobProfitInputs {
  jobs: Job[];
  arInvoices: ArInvoice[];
  apInvoices: ApInvoice[];
  changeOrders: ChangeOrder[];
  expenses?: Expense[];
  mileage?: MileageEntry[];
}

/** Build a profitability row per job. Skips jobs with no AR + no AP
 *  activity. */
export function buildJobProfitRows(inputs: JobProfitInputs): JobProfitRow[] {
  const { jobs, arInvoices, apInvoices, changeOrders } = inputs;
  const expenses = inputs.expenses ?? [];
  const mileage = inputs.mileage ?? [];

  // Build a Set of jobIds that have any activity at all.
  const activeJobIds = new Set<string>();
  for (const i of arInvoices) activeJobIds.add(i.jobId);
  for (const ap of apInvoices) {
    if (ap.jobId) activeJobIds.add(ap.jobId);
  }
  for (const co of changeOrders) activeJobIds.add(co.jobId);
  for (const e of expenses) {
    if (e.jobId) activeJobIds.add(e.jobId);
  }
  for (const m of mileage) {
    if (m.jobId) activeJobIds.add(m.jobId);
  }

  const rows: JobProfitRow[] = [];
  for (const job of jobs) {
    if (!activeJobIds.has(job.id)) continue;

    let revenueBilledCents = 0;
    let revenueOutstandingCents = 0;
    for (const i of arInvoices) {
      if (i.jobId !== job.id) continue;
      if (i.status === 'DRAFT') continue;
      revenueBilledCents += i.totalCents;
      if (i.status !== 'PAID' && i.status !== 'WRITTEN_OFF') {
        revenueOutstandingCents += arUnpaidBalanceCents(i);
      }
    }

    let apCents = 0;
    for (const ap of apInvoices) {
      if (ap.jobId !== job.id) continue;
      if (ap.status === 'APPROVED' || ap.status === 'PAID') {
        apCents += ap.totalCents;
      }
    }

    let expenseCents = 0;
    for (const e of expenses) {
      if (e.jobId !== job.id) continue;
      expenseCents += expenseReimbursableCents(e);
    }

    let mileageCents = 0;
    for (const m of mileage) {
      if (m.jobId !== job.id) continue;
      mileageCents += reimbursementCents(m);
    }

    let changeOrderTotalCents = 0;
    for (const co of changeOrders) {
      if (co.jobId !== job.id) continue;
      if (co.status === 'APPROVED' || co.status === 'EXECUTED') {
        changeOrderTotalCents += co.totalCostImpactCents;
      }
    }

    const totalCostsCents = apCents + expenseCents + mileageCents;
    const grossProfitCents = revenueBilledCents - totalCostsCents;
    const grossMargin =
      revenueBilledCents > 0 ? grossProfitCents / revenueBilledCents : 0;

    rows.push({
      jobId: job.id,
      projectName: job.projectName,
      status: job.status,
      revenueBilledCents,
      revenueOutstandingCents,
      changeOrderTotalCents,
      costsByCategory: { apCents, expenseCents, mileageCents },
      totalCostsCents,
      grossProfitCents,
      grossMargin,
    });
  }

  return rows;
}

/** Sort: worst margin first so bleeders surface. Jobs with $0 revenue
 *  but real costs end up at the top (margin = 0 but GP is negative). */
export function sortJobProfitRowsBleedersFirst(rows: JobProfitRow[]): JobProfitRow[] {
  return [...rows].sort((a, b) => a.grossProfitCents - b.grossProfitCents);
}

export interface JobProfitRollup {
  jobs: number;
  totalRevenueCents: number;
  totalCostsCents: number;
  totalGrossProfitCents: number;
  /** Aggregate margin across all jobs. */
  blendedMargin: number;
  /** Number of jobs running negative GP. */
  unprofitableJobs: number;
}

export function computeJobProfitRollup(rows: JobProfitRow[]): JobProfitRollup {
  let totalRevenueCents = 0;
  let totalCostsCents = 0;
  let totalGrossProfitCents = 0;
  let unprofitableJobs = 0;
  for (const r of rows) {
    totalRevenueCents += r.revenueBilledCents;
    totalCostsCents += r.totalCostsCents;
    totalGrossProfitCents += r.grossProfitCents;
    if (r.grossProfitCents < 0) unprofitableJobs += 1;
  }
  return {
    jobs: rows.length,
    totalRevenueCents,
    totalCostsCents,
    totalGrossProfitCents,
    blendedMargin:
      totalRevenueCents > 0 ? totalGrossProfitCents / totalRevenueCents : 0,
    unprofitableJobs,
  };
}
