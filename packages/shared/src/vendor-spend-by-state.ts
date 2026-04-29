// Per-state vendor AP spend rollup.
//
// Plain English: join AP invoices to Vendor records by canonical
// legalName, then bucket totals by Vendor.state. Heavy civil AP
// is mostly in-state for subs (CSLB) but suppliers and trucking
// are often regional. Tracks geographic spend concentration —
// useful for diversification review and out-of-state W-9 chase
// planning.
//
// Per row: state, totalCents, paidCents, openCents,
// invoiceCount, distinctVendors, distinctJobs.
//
// Sort: totalCents desc.
//
// Different from vendor-by-state (count snapshot, no spend),
// vendor-spend (per-vendor totals), vendor-concentration (per-
// vendor share), customer-revenue-by-state (AR side).
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Vendor } from './vendor';

export interface VendorSpendByStateRow {
  state: string;
  totalCents: number;
  paidCents: number;
  openCents: number;
  invoiceCount: number;
  distinctVendors: number;
  distinctJobs: number;
}

export interface VendorSpendByStateRollup {
  statesConsidered: number;
  totalInvoices: number;
  totalCents: number;
  paidCents: number;
  openCents: number;
  unattributed: number;
}

export interface VendorSpendByStateInputs {
  vendors: Vendor[];
  apInvoices: ApInvoice[];
  /** Optional yyyy-mm-dd window applied to invoiceDate. */
  fromDate?: string;
  toDate?: string;
}

function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(llc|inc|corp|co|ltd|company)\b/g, '')
    .replace(/[.,&'()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildVendorSpendByState(
  inputs: VendorSpendByStateInputs,
): {
  rollup: VendorSpendByStateRollup;
  rows: VendorSpendByStateRow[];
} {
  // Index vendor state by canonical legalName.
  const stateByName = new Map<string, string>();
  for (const v of inputs.vendors) {
    if (!v.state) continue;
    stateByName.set(normName(v.legalName), v.state);
  }

  type Acc = {
    state: string;
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
  let unattributed = 0;

  const fromD = inputs.fromDate;
  const toD = inputs.toDate;

  for (const inv of inputs.apInvoices) {
    if (fromD && inv.invoiceDate < fromD) continue;
    if (toD && inv.invoiceDate > toD) continue;

    const vKey = normName(inv.vendorName);
    const state = stateByName.get(vKey);
    if (!state) {
      unattributed += 1;
      continue;
    }
    let a = accs.get(state);
    if (!a) {
      a = {
        state,
        totalCents: 0,
        paidCents: 0,
        invoiceCount: 0,
        vendors: new Set(),
        jobs: new Set(),
      };
      accs.set(state, a);
    }
    a.totalCents += inv.totalCents ?? 0;
    a.paidCents += inv.paidCents ?? 0;
    a.invoiceCount += 1;
    a.vendors.add(vKey);
    if (inv.jobId) a.jobs.add(inv.jobId);

    totalInvoices += 1;
    totalCents += inv.totalCents ?? 0;
    paidCents += inv.paidCents ?? 0;
  }

  const rows: VendorSpendByStateRow[] = [...accs.values()]
    .map((a) => ({
      state: a.state,
      totalCents: a.totalCents,
      paidCents: a.paidCents,
      openCents: Math.max(0, a.totalCents - a.paidCents),
      invoiceCount: a.invoiceCount,
      distinctVendors: a.vendors.size,
      distinctJobs: a.jobs.size,
    }))
    .sort((x, y) => y.totalCents - x.totalCents);

  return {
    rollup: {
      statesConsidered: rows.length,
      totalInvoices,
      totalCents,
      paidCents,
      openCents: Math.max(0, totalCents - paidCents),
      unattributed,
    },
    rows,
  };
}
