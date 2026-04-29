// Per (customer, month) revenue vs cost rollup.
//
// Plain English: combine the AR side (billed cents from
// invoices) with the AP side (incurred cents from invoices,
// employee expenses, mileage reimbursable, equipment dispatch
// hours x simple loaded rate is OUT OF SCOPE — caller can
// layer that on later). Per (customerName, yyyy-mm), surface
// billed, costIncurred, gross margin, marginPct.
//
// Joins:
//  - AR invoices via customerName matched to Customer.legalName
//    or dbaName (canonical) — falls back to Job.ownerAgency when
//    customer master miss.
//  - AP invoices via Job → ownerAgency.
//  - Expenses via Job → ownerAgency.
//
// Per row: customerName, month, billedCents, costCents, marginCents,
// marginPct (0..1 or null), distinctJobs.
//
// Sort: customerName asc, month asc.
//
// Different from customer-revenue-by-job (no time + no cost),
// customer-ap-spend-monthly (cost only), customer-cash-net-
// monthly (cash basis, this is accrual basis).
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { ArInvoice } from './ar-invoice';
import type { Customer } from './customer';
import type { Expense } from './expense';
import type { Job } from './job';

export interface CustomerRevenueVsCostMonthlyRow {
  customerName: string;
  month: string;
  billedCents: number;
  costCents: number;
  marginCents: number;
  marginPct: number | null;
  distinctJobs: number;
}

export interface CustomerRevenueVsCostMonthlyRollup {
  customersConsidered: number;
  monthsConsidered: number;
  billedCents: number;
  costCents: number;
  marginCents: number;
  unattributed: number;
}

export interface CustomerRevenueVsCostMonthlyInputs {
  arInvoices: ArInvoice[];
  apInvoices: ApInvoice[];
  expenses: Expense[];
  customers: Customer[];
  jobs: Job[];
  /** Optional yyyy-mm bounds inclusive applied to invoiceDate / receiptDate. */
  fromMonth?: string;
  toMonth?: string;
}

function normName(s: string): string {
  return s.toLowerCase().trim();
}

export function buildCustomerRevenueVsCostMonthly(
  inputs: CustomerRevenueVsCostMonthlyInputs,
): {
  rollup: CustomerRevenueVsCostMonthlyRollup;
  rows: CustomerRevenueVsCostMonthlyRow[];
} {
  const jobCustomer = new Map<string, string | undefined>();
  for (const j of inputs.jobs) {
    jobCustomer.set(j.id, j.ownerAgency);
  }
  const customerByName = new Map<string, string>();
  for (const c of inputs.customers) {
    customerByName.set(normName(c.legalName), c.legalName);
    if (c.dbaName) customerByName.set(normName(c.dbaName), c.legalName);
  }

  type Acc = {
    customerName: string;
    month: string;
    billedCents: number;
    costCents: number;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const customers = new Set<string>();
  const months = new Set<string>();

  let billedCents = 0;
  let costCents = 0;
  let unattributed = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  function bump(
    customerName: string,
    month: string,
    field: 'billedCents' | 'costCents',
    cents: number,
    jobId?: string,
  ): void {
    const cKey = customerName.toLowerCase().trim();
    const key = `${cKey}__${month}`;
    let a = accs.get(key);
    if (!a) {
      a = {
        customerName,
        month,
        billedCents: 0,
        costCents: 0,
        jobs: new Set(),
      };
      accs.set(key, a);
    }
    a[field] += cents;
    if (jobId) a.jobs.add(jobId);
    customers.add(cKey);
    months.add(month);
  }

  for (const inv of inputs.arInvoices) {
    const month = inv.invoiceDate.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;
    const matched = customerByName.get(normName(inv.customerName));
    const fallback = jobCustomer.get(inv.jobId);
    const customerName = matched ?? fallback ?? inv.customerName;
    if (!customerName) {
      unattributed += 1;
      continue;
    }
    const cents = inv.totalCents ?? 0;
    bump(customerName, month, 'billedCents', cents, inv.jobId);
    billedCents += cents;
  }

  for (const inv of inputs.apInvoices) {
    const month = inv.invoiceDate.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;
    const customerName = inv.jobId ? jobCustomer.get(inv.jobId) : undefined;
    if (!customerName) {
      unattributed += 1;
      continue;
    }
    const cents = inv.totalCents ?? 0;
    bump(customerName, month, 'costCents', cents, inv.jobId);
    costCents += cents;
  }

  for (const e of inputs.expenses) {
    const month = e.receiptDate.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;
    const customerName = e.jobId ? jobCustomer.get(e.jobId) : undefined;
    if (!customerName) {
      unattributed += 1;
      continue;
    }
    bump(customerName, month, 'costCents', e.amountCents, e.jobId);
    costCents += e.amountCents;
  }

  const rows: CustomerRevenueVsCostMonthlyRow[] = [...accs.values()]
    .map((a) => {
      const margin = a.billedCents - a.costCents;
      const pct = a.billedCents > 0 ? margin / a.billedCents : null;
      return {
        customerName: a.customerName,
        month: a.month,
        billedCents: a.billedCents,
        costCents: a.costCents,
        marginCents: margin,
        marginPct: pct,
        distinctJobs: a.jobs.size,
      };
    })
    .sort((x, y) => {
      const cn = x.customerName.localeCompare(y.customerName);
      if (cn !== 0) return cn;
      return x.month.localeCompare(y.month);
    });

  return {
    rollup: {
      customersConsidered: customers.size,
      monthsConsidered: months.size,
      billedCents,
      costCents,
      marginCents: billedCents - costCents,
      unattributed,
    },
    rows,
  };
}
