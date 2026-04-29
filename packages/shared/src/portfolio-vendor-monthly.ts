// Portfolio AP vendor activity by month.
//
// Plain English: per yyyy-mm of invoiceDate, sum AP cents +
// paid cents + open cents, count distinct vendors, total
// invoice count. Drives the AP throughput trend.
//
// Per row: month, totalCents, paidCents, openCents, invoiceCount,
// distinctVendors, distinctJobs.
//
// Sort: month asc.
//
// Different from ap-monthly-volume (count + cents only),
// vendor-spend-monthly (per vendor row), customer-ap-spend-
// monthly (per customer).
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';

export interface PortfolioVendorMonthlyRow {
  month: string;
  totalCents: number;
  paidCents: number;
  openCents: number;
  invoiceCount: number;
  distinctVendors: number;
  distinctJobs: number;
}

export interface PortfolioVendorMonthlyRollup {
  monthsConsidered: number;
  totalInvoices: number;
  totalCents: number;
  paidCents: number;
  openCents: number;
}

export interface PortfolioVendorMonthlyInputs {
  apInvoices: ApInvoice[];
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

export function buildPortfolioVendorMonthly(
  inputs: PortfolioVendorMonthlyInputs,
): {
  rollup: PortfolioVendorMonthlyRollup;
  rows: PortfolioVendorMonthlyRow[];
} {
  type Acc = {
    month: string;
    totalCents: number;
    paidCents: number;
    invoiceCount: number;
    vendors: Set<string>;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();

  let totalInvoices = 0;
  let totalCents = 0;
  let paidCents = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const inv of inputs.apInvoices) {
    const month = inv.invoiceDate.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    let a = accs.get(month);
    if (!a) {
      a = {
        month,
        totalCents: 0,
        paidCents: 0,
        invoiceCount: 0,
        vendors: new Set(),
        jobs: new Set(),
      };
      accs.set(month, a);
    }
    a.totalCents += inv.totalCents ?? 0;
    a.paidCents += inv.paidCents ?? 0;
    a.invoiceCount += 1;
    a.vendors.add(normVendor(inv.vendorName));
    if (inv.jobId) a.jobs.add(inv.jobId);

    totalInvoices += 1;
    totalCents += inv.totalCents ?? 0;
    paidCents += inv.paidCents ?? 0;
  }

  const rows: PortfolioVendorMonthlyRow[] = [...accs.values()]
    .map((a) => ({
      month: a.month,
      totalCents: a.totalCents,
      paidCents: a.paidCents,
      openCents: Math.max(0, a.totalCents - a.paidCents),
      invoiceCount: a.invoiceCount,
      distinctVendors: a.vendors.size,
      distinctJobs: a.jobs.size,
    }))
    .sort((x, y) => x.month.localeCompare(y.month));

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalInvoices,
      totalCents,
      paidCents,
      openCents: Math.max(0, totalCents - paidCents),
    },
    rows,
  };
}
