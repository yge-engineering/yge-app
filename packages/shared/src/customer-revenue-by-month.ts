// Customer revenue trend by month.
//
// Plain English: bucket AR invoices by yyyy-mm of invoiceDate AND
// customer canonical name, summing total \$ billed per
// (customer, month) pair. Pivots into a long-format result with
// distinct months and customers visible. Useful for the "show me
// the trend on Caltrans D2 over 12 months" view.
//
// Per row: customerName, month, totalCents, invoiceCount,
// distinctJobs.
//
// Sort: customerName asc, month asc.
//
// Different from monthly-billing (per-month single line),
// ar-monthly-volume (per-month with status mix),
// customer-month-matrix (cell matrix view, count not \$),
// customer-lifetime (lifetime aggregate).
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';

export interface CustomerRevenueByMonthRow {
  customerName: string;
  month: string;
  totalCents: number;
  invoiceCount: number;
  distinctJobs: number;
}

export interface CustomerRevenueByMonthRollup {
  customersConsidered: number;
  monthsConsidered: number;
  totalCents: number;
}

export interface CustomerRevenueByMonthInputs {
  arInvoices: ArInvoice[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildCustomerRevenueByMonth(
  inputs: CustomerRevenueByMonthInputs,
): {
  rollup: CustomerRevenueByMonthRollup;
  rows: CustomerRevenueByMonthRow[];
} {
  type Acc = {
    display: string;
    month: string;
    cents: number;
    invoices: number;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const customerSet = new Set<string>();
  const monthSet = new Set<string>();
  let totalCents = 0;

  for (const inv of inputs.arInvoices) {
    const month = inv.invoiceDate.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const key = `${canonicalize(inv.customerName)}|${month}`;
    const acc = accs.get(key) ?? {
      display: inv.customerName,
      month,
      cents: 0,
      invoices: 0,
      jobs: new Set<string>(),
    };
    acc.cents += inv.totalCents;
    acc.invoices += 1;
    acc.jobs.add(inv.jobId);
    accs.set(key, acc);
    customerSet.add(canonicalize(inv.customerName));
    monthSet.add(month);
    totalCents += inv.totalCents;
  }

  const rows: CustomerRevenueByMonthRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      customerName: acc.display,
      month: acc.month,
      totalCents: acc.cents,
      invoiceCount: acc.invoices,
      distinctJobs: acc.jobs.size,
    });
  }

  rows.sort((a, b) => {
    if (a.customerName !== b.customerName) {
      return a.customerName.localeCompare(b.customerName);
    }
    return a.month.localeCompare(b.month);
  });

  return {
    rollup: {
      customersConsidered: customerSet.size,
      monthsConsidered: monthSet.size,
      totalCents,
    },
    rows,
  };
}

function canonicalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,'"`]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(llc|inc|incorporated|corp|corporation|co|company|ltd|limited|department|dept|of)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
