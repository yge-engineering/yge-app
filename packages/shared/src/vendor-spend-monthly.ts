// Per-vendor monthly AP spend.
//
// Plain English: bucket AP invoices by (canonicalized vendor
// name, yyyy-mm of invoiceDate). Long-format result. Useful for
// "show me the trend on Granite Construction over 12 months."
//
// Per row: vendorName, month, totalCents, invoiceCount,
// distinctJobs.
//
// Sort: vendorName asc, month asc.
//
// Different from vendor-spend (per-vendor lifetime),
// ap-monthly-volume (per-month, all vendors together),
// vendor-payment-velocity (per-vendor timing).
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';

export interface VendorSpendMonthlyRow {
  vendorName: string;
  month: string;
  totalCents: number;
  invoiceCount: number;
  distinctJobs: number;
}

export interface VendorSpendMonthlyRollup {
  vendorsConsidered: number;
  monthsConsidered: number;
  totalCents: number;
}

export interface VendorSpendMonthlyInputs {
  apInvoices: ApInvoice[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildVendorSpendMonthly(
  inputs: VendorSpendMonthlyInputs,
): {
  rollup: VendorSpendMonthlyRollup;
  rows: VendorSpendMonthlyRow[];
} {
  type Acc = {
    display: string;
    month: string;
    cents: number;
    invoices: number;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const vendorSet = new Set<string>();
  const monthSet = new Set<string>();
  let totalCents = 0;

  for (const inv of inputs.apInvoices) {
    const month = inv.invoiceDate.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const canonical = canonicalize(inv.vendorName);
    const key = `${canonical}|${month}`;
    const acc = accs.get(key) ?? {
      display: inv.vendorName,
      month,
      cents: 0,
      invoices: 0,
      jobs: new Set<string>(),
    };
    acc.cents += inv.totalCents;
    acc.invoices += 1;
    if (inv.jobId) acc.jobs.add(inv.jobId);
    accs.set(key, acc);
    vendorSet.add(canonical);
    monthSet.add(month);
    totalCents += inv.totalCents;
  }

  const rows: VendorSpendMonthlyRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      vendorName: acc.display,
      month: acc.month,
      totalCents: acc.cents,
      invoiceCount: acc.invoices,
      distinctJobs: acc.jobs.size,
    });
  }

  rows.sort((a, b) => {
    if (a.vendorName !== b.vendorName) return a.vendorName.localeCompare(b.vendorName);
    return a.month.localeCompare(b.month);
  });

  return {
    rollup: {
      vendorsConsidered: vendorSet.size,
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
    .replace(/\b(llc|inc|incorporated|corp|corporation|co|company|ltd|limited)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
