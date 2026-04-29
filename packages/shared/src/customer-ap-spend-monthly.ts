// Per (customer, month) AP spend rollup.
//
// Plain English: join AP invoices to customers via Job →
// ownerAgency, then bucket by (customerName, yyyy-mm of
// invoiceDate). Sums billed + paid + open cents, distinct
// vendors. Tells YGE how much sub/supplier cost is rolling
// onto each agency client month over month — the AP-side
// counterpart to customer-revenue-by-job.
//
// Per row: customerName, month, total, totalCents, paidCents,
// openCents, distinctVendors, distinctJobs.
//
// Sort: customerName asc, month asc.
//
// Different from job-ap-spend-monthly (per job axis),
// vendor-spend-monthly (per vendor axis), customer-revenue-
// by-job (AR side, no time axis).
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Job } from './job';

export interface CustomerApSpendMonthlyRow {
  customerName: string;
  month: string;
  total: number;
  totalCents: number;
  paidCents: number;
  openCents: number;
  distinctVendors: number;
  distinctJobs: number;
}

export interface CustomerApSpendMonthlyRollup {
  customersConsidered: number;
  monthsConsidered: number;
  totalInvoices: number;
  totalCents: number;
  paidCents: number;
  openCents: number;
  unattributed: number;
}

export interface CustomerApSpendMonthlyInputs {
  apInvoices: ApInvoice[];
  jobs: Job[];
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

export function buildCustomerApSpendMonthly(
  inputs: CustomerApSpendMonthlyInputs,
): {
  rollup: CustomerApSpendMonthlyRollup;
  rows: CustomerApSpendMonthlyRow[];
} {
  const jobCustomer = new Map<string, string | undefined>();
  for (const j of inputs.jobs) {
    jobCustomer.set(j.id, j.ownerAgency);
  }

  type Acc = {
    customerName: string;
    month: string;
    total: number;
    totalCents: number;
    paidCents: number;
    vendors: Set<string>;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const customers = new Set<string>();
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

    const customerName = inv.jobId ? jobCustomer.get(inv.jobId) : undefined;
    if (!customerName) {
      unattributed += 1;
      continue;
    }
    const cKey = customerName.toLowerCase().trim();
    const key = `${cKey}__${month}`;
    let a = accs.get(key);
    if (!a) {
      a = {
        customerName,
        month,
        total: 0,
        totalCents: 0,
        paidCents: 0,
        vendors: new Set(),
        jobs: new Set(),
      };
      accs.set(key, a);
    }
    a.total += 1;
    a.totalCents += inv.totalCents ?? 0;
    a.paidCents += inv.paidCents ?? 0;
    a.vendors.add(normVendor(inv.vendorName));
    if (inv.jobId) a.jobs.add(inv.jobId);

    customers.add(cKey);
    months.add(month);
    totalInvoices += 1;
    totalCents += inv.totalCents ?? 0;
    paidCents += inv.paidCents ?? 0;
  }

  const rows: CustomerApSpendMonthlyRow[] = [...accs.values()]
    .map((a) => ({
      customerName: a.customerName,
      month: a.month,
      total: a.total,
      totalCents: a.totalCents,
      paidCents: a.paidCents,
      openCents: Math.max(0, a.totalCents - a.paidCents),
      distinctVendors: a.vendors.size,
      distinctJobs: a.jobs.size,
    }))
    .sort((x, y) => {
      const cn = x.customerName.localeCompare(y.customerName);
      if (cn !== 0) return cn;
      return x.month.localeCompare(y.month);
    });

  return {
    rollup: {
      customersConsidered: customers.size,
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
