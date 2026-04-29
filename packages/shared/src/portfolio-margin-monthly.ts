// Portfolio margin by month.
//
// Plain English: company-wide AR billed minus AP cost +
// employee expense cost, bucketed by yyyy-mm. Drives the
// owner's monthly margin chart.
//
// Per row: month, billedCents, costCents, marginCents,
// marginPct, distinctJobs, distinctCustomers (via Job →
// ownerAgency), cumulativeBilledCents, cumulativeCostCents,
// cumulativeMarginCents.
//
// Sort: month asc.
//
// Different from job-revenue-vs-cost-monthly (per job),
// customer-revenue-vs-cost-monthly (per customer),
// monthly-cash-net (cash basis, no margin).
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { ArInvoice } from './ar-invoice';
import type { Expense } from './expense';
import type { Job } from './job';

export interface PortfolioMarginMonthlyRow {
  month: string;
  billedCents: number;
  costCents: number;
  marginCents: number;
  marginPct: number | null;
  distinctJobs: number;
  distinctCustomers: number;
  cumulativeBilledCents: number;
  cumulativeCostCents: number;
  cumulativeMarginCents: number;
}

export interface PortfolioMarginMonthlyRollup {
  monthsConsidered: number;
  billedCents: number;
  costCents: number;
  marginCents: number;
  marginPct: number | null;
}

export interface PortfolioMarginMonthlyInputs {
  arInvoices: ArInvoice[];
  apInvoices: ApInvoice[];
  expenses: Expense[];
  jobs: Job[];
  /** Optional yyyy-mm bounds inclusive applied to invoiceDate / receiptDate. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildPortfolioMarginMonthly(
  inputs: PortfolioMarginMonthlyInputs,
): {
  rollup: PortfolioMarginMonthlyRollup;
  rows: PortfolioMarginMonthlyRow[];
} {
  const jobCustomer = new Map<string, string | undefined>();
  for (const j of inputs.jobs) {
    jobCustomer.set(j.id, j.ownerAgency);
  }

  type Acc = {
    month: string;
    billedCents: number;
    costCents: number;
    jobs: Set<string>;
    customers: Set<string>;
  };
  const accs = new Map<string, Acc>();

  let billedCents = 0;
  let costCents = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  function bump(
    month: string,
    field: 'billedCents' | 'costCents',
    cents: number,
    jobId?: string,
  ): void {
    let a = accs.get(month);
    if (!a) {
      a = {
        month,
        billedCents: 0,
        costCents: 0,
        jobs: new Set(),
        customers: new Set(),
      };
      accs.set(month, a);
    }
    a[field] += cents;
    if (jobId) {
      a.jobs.add(jobId);
      const customer = jobCustomer.get(jobId);
      if (customer) a.customers.add(customer.toLowerCase().trim());
    }
  }

  for (const inv of inputs.arInvoices) {
    const month = inv.invoiceDate.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;
    bump(month, 'billedCents', inv.totalCents ?? 0, inv.jobId);
    billedCents += inv.totalCents ?? 0;
  }

  for (const inv of inputs.apInvoices) {
    const month = inv.invoiceDate.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;
    bump(month, 'costCents', inv.totalCents ?? 0, inv.jobId);
    costCents += inv.totalCents ?? 0;
  }

  for (const e of inputs.expenses) {
    const month = e.receiptDate.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;
    bump(month, 'costCents', e.amountCents, e.jobId);
    costCents += e.amountCents;
  }

  const sorted = [...accs.values()].sort((x, y) => x.month.localeCompare(y.month));
  let cumBilled = 0;
  let cumCost = 0;

  const rows: PortfolioMarginMonthlyRow[] = sorted.map((a) => {
    cumBilled += a.billedCents;
    cumCost += a.costCents;
    const margin = a.billedCents - a.costCents;
    const pct = a.billedCents > 0 ? margin / a.billedCents : null;
    return {
      month: a.month,
      billedCents: a.billedCents,
      costCents: a.costCents,
      marginCents: margin,
      marginPct: pct,
      distinctJobs: a.jobs.size,
      distinctCustomers: a.customers.size,
      cumulativeBilledCents: cumBilled,
      cumulativeCostCents: cumCost,
      cumulativeMarginCents: cumBilled - cumCost,
    };
  });

  const portfolioMargin = billedCents - costCents;
  return {
    rollup: {
      monthsConsidered: rows.length,
      billedCents,
      costCents,
      marginCents: portfolioMargin,
      marginPct: billedCents > 0 ? portfolioMargin / billedCents : null,
    },
    rows,
  };
}
