// Per (job, month) AR billing rollup.
//
// Plain English: bucket AR invoices by (jobId, yyyy-mm of
// invoiceDate). Sums billed cents, paid cents, open cents,
// retention cents held. Tells YGE the per-month billing pace
// on each job — does the AR climb steadily, or did billing
// stall in May because we missed a pay-app cutoff?
//
// Per row: jobId, month, total, totalCents, paidCents,
// openCents, retentionCents.
//
// Sort: jobId asc, month asc.
//
// Different from monthly-billing (single line per month),
// customer-revenue-by-month (per customer not per job),
// daily-ar-billing (per-day not per-month),
// job-ar-aging (current open AR by age),
// job-ap-spend-monthly (AP not AR side).
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';

export interface JobArBillingMonthlyRow {
  jobId: string;
  month: string;
  total: number;
  totalCents: number;
  paidCents: number;
  openCents: number;
  retentionCents: number;
}

export interface JobArBillingMonthlyRollup {
  jobsConsidered: number;
  monthsConsidered: number;
  totalInvoices: number;
  totalCents: number;
  paidCents: number;
  openCents: number;
  retentionCents: number;
}

export interface JobArBillingMonthlyInputs {
  arInvoices: ArInvoice[];
  /** Optional yyyy-mm bounds inclusive applied to invoiceDate. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildJobArBillingMonthly(
  inputs: JobArBillingMonthlyInputs,
): {
  rollup: JobArBillingMonthlyRollup;
  rows: JobArBillingMonthlyRow[];
} {
  type Acc = {
    jobId: string;
    month: string;
    total: number;
    totalCents: number;
    paidCents: number;
    retentionCents: number;
  };
  const accs = new Map<string, Acc>();
  const jobs = new Set<string>();
  const months = new Set<string>();

  let totalInvoices = 0;
  let totalCents = 0;
  let paidCents = 0;
  let retentionCents = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const inv of inputs.arInvoices) {
    const month = inv.invoiceDate.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;
    const key = `${inv.jobId}__${month}`;
    let a = accs.get(key);
    if (!a) {
      a = {
        jobId: inv.jobId,
        month,
        total: 0,
        totalCents: 0,
        paidCents: 0,
        retentionCents: 0,
      };
      accs.set(key, a);
    }
    a.total += 1;
    a.totalCents += inv.totalCents ?? 0;
    a.paidCents += inv.paidCents ?? 0;
    a.retentionCents += inv.retentionCents ?? 0;

    jobs.add(inv.jobId);
    months.add(month);
    totalInvoices += 1;
    totalCents += inv.totalCents ?? 0;
    paidCents += inv.paidCents ?? 0;
    retentionCents += inv.retentionCents ?? 0;
  }

  const rows: JobArBillingMonthlyRow[] = [...accs.values()]
    .map((a) => ({
      jobId: a.jobId,
      month: a.month,
      total: a.total,
      totalCents: a.totalCents,
      paidCents: a.paidCents,
      openCents: Math.max(0, a.totalCents - a.paidCents),
      retentionCents: a.retentionCents,
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
      retentionCents,
    },
    rows,
  };
}
