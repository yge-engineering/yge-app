// Per (vendor, job) AP spend rollup.
//
// Plain English: bucket AP invoices by (canonicalized vendor,
// jobId) — total \$, invoice count, first/last invoice date,
// distinct months. Useful for "show me everything we paid
// Granite Construction on Sulphur Springs" cost-report
// reconciliation.
//
// Per row: vendorName, jobId, totalCents, invoiceCount,
// firstInvoiceDate, lastInvoiceDate, distinctMonths.
//
// Sort: vendorName asc, totalCents desc within vendor.
//
// Different from vendor-spend-monthly (per-month per-vendor),
// vendor-job-crosstab (matrix view).
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';

export interface VendorSpendByJobRow {
  vendorName: string;
  jobId: string;
  totalCents: number;
  invoiceCount: number;
  firstInvoiceDate: string;
  lastInvoiceDate: string;
  distinctMonths: number;
}

export interface VendorSpendByJobRollup {
  vendorsConsidered: number;
  jobsConsidered: number;
  totalCents: number;
  unattributed: number;
}

export interface VendorSpendByJobInputs {
  apInvoices: ApInvoice[];
  /** Optional yyyy-mm-dd window applied to invoiceDate. */
  fromDate?: string;
  toDate?: string;
}

export function buildVendorSpendByJob(
  inputs: VendorSpendByJobInputs,
): {
  rollup: VendorSpendByJobRollup;
  rows: VendorSpendByJobRow[];
} {
  type Acc = {
    display: string;
    jobId: string;
    cents: number;
    invoices: number;
    firstDate: string;
    lastDate: string;
    months: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const vendorSet = new Set<string>();
  const jobSet = new Set<string>();
  let totalCents = 0;
  let unattributed = 0;

  for (const inv of inputs.apInvoices) {
    if (inputs.fromDate && inv.invoiceDate < inputs.fromDate) continue;
    if (inputs.toDate && inv.invoiceDate > inputs.toDate) continue;
    if (!inv.jobId) {
      unattributed += 1;
      continue;
    }
    const canonical = canonicalize(inv.vendorName);
    const key = `${canonical}|${inv.jobId}`;
    const acc = accs.get(key) ?? {
      display: inv.vendorName,
      jobId: inv.jobId,
      cents: 0,
      invoices: 0,
      firstDate: inv.invoiceDate,
      lastDate: inv.invoiceDate,
      months: new Set<string>(),
    };
    acc.cents += inv.totalCents;
    acc.invoices += 1;
    if (inv.invoiceDate < acc.firstDate) acc.firstDate = inv.invoiceDate;
    if (inv.invoiceDate > acc.lastDate) acc.lastDate = inv.invoiceDate;
    acc.months.add(inv.invoiceDate.slice(0, 7));
    accs.set(key, acc);
    vendorSet.add(canonical);
    jobSet.add(inv.jobId);
    totalCents += inv.totalCents;
  }

  const rows: VendorSpendByJobRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      vendorName: acc.display,
      jobId: acc.jobId,
      totalCents: acc.cents,
      invoiceCount: acc.invoices,
      firstInvoiceDate: acc.firstDate,
      lastInvoiceDate: acc.lastDate,
      distinctMonths: acc.months.size,
    });
  }

  rows.sort((a, b) => {
    if (a.vendorName !== b.vendorName) return a.vendorName.localeCompare(b.vendorName);
    return b.totalCents - a.totalCents;
  });

  return {
    rollup: {
      vendorsConsidered: vendorSet.size,
      jobsConsidered: jobSet.size,
      totalCents,
      unattributed,
    },
    rows,
  };
}

function canonicalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,'"`]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(llc|inc|incorporated|corp|corporation|co|company|ltd|limited)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
