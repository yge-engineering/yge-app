// Vendor payment-terms mix.
//
// Plain English: every vendor on file carries a paymentTerms field
// (NET_30 / NET_60 / NET_15 / NET_45 / NET_10 / DUE_ON_RECEIPT /
// COD / PREPAID / OTHER). What we actually pay against those terms
// is in the AP invoice ledger. This rolls vendor-side terms × AP
// dollars together so the bookkeeper sees how much float we're
// getting from suppliers vs paying COD on rentals.
//
// Per row: terms, vendorCount (in registry), invoiceCount,
// totalAmountCents, avgInvoiceCents, share (of total AP $).
//
// Sort by totalAmountCents desc.
//
// Different from vendor-spend (per-vendor totals),
// vendor-concentration (per-vendor share of total),
// vendor-payment-velocity (how fast we paid them),
// and vendor-payment-method-mix (CHECK/ACH/WIRE breakdown).
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Vendor, VendorPaymentTerms } from './vendor';

export interface VendorPaymentTermsRow {
  terms: VendorPaymentTerms;
  vendorCount: number;
  invoiceCount: number;
  totalAmountCents: number;
  avgInvoiceCents: number;
  share: number;
}

export interface VendorPaymentTermsRollup {
  termsConsidered: number;
  totalVendors: number;
  totalInvoices: number;
  totalAmountCents: number;
  unmatchedInvoices: number;
}

export interface VendorPaymentTermsInputs {
  vendors: Vendor[];
  apInvoices: ApInvoice[];
  /** Optional yyyy-mm-dd window applied to invoiceDate. */
  fromDate?: string;
  toDate?: string;
}

export function buildVendorPaymentTermsMix(
  inputs: VendorPaymentTermsInputs,
): {
  rollup: VendorPaymentTermsRollup;
  rows: VendorPaymentTermsRow[];
} {
  // Index vendor terms by canonical legal name + dba name.
  const termsByKey = new Map<string, VendorPaymentTerms>();
  const vendorCountByTerms = new Map<VendorPaymentTerms, number>();
  for (const v of inputs.vendors) {
    if (v.legalName) termsByKey.set(canonicalize(v.legalName), v.paymentTerms);
    if (v.dbaName) termsByKey.set(canonicalize(v.dbaName), v.paymentTerms);
    vendorCountByTerms.set(v.paymentTerms, (vendorCountByTerms.get(v.paymentTerms) ?? 0) + 1);
  }

  type Acc = { invoices: number; amount: number };
  const accs = new Map<VendorPaymentTerms, Acc>();
  let unmatched = 0;
  let totalAmount = 0;
  let totalInvoices = 0;

  for (const inv of inputs.apInvoices) {
    if (inputs.fromDate && inv.invoiceDate < inputs.fromDate) continue;
    if (inputs.toDate && inv.invoiceDate > inputs.toDate) continue;
    totalInvoices += 1;
    totalAmount += inv.totalCents;
    const key = canonicalize(inv.vendorName);
    const terms = termsByKey.get(key);
    if (!terms) {
      unmatched += 1;
      continue;
    }
    const acc = accs.get(terms) ?? { invoices: 0, amount: 0 };
    acc.invoices += 1;
    acc.amount += inv.totalCents;
    accs.set(terms, acc);
  }

  const rows: VendorPaymentTermsRow[] = [];
  for (const [terms, acc] of accs.entries()) {
    const avg = acc.invoices === 0
      ? 0
      : Math.round(acc.amount / acc.invoices);
    const share = totalAmount === 0
      ? 0
      : Math.round((acc.amount / totalAmount) * 10_000) / 10_000;
    rows.push({
      terms,
      vendorCount: vendorCountByTerms.get(terms) ?? 0,
      invoiceCount: acc.invoices,
      totalAmountCents: acc.amount,
      avgInvoiceCents: avg,
      share,
    });
  }

  rows.sort((a, b) => b.totalAmountCents - a.totalAmountCents);

  return {
    rollup: {
      termsConsidered: rows.length,
      totalVendors: inputs.vendors.length,
      totalInvoices,
      totalAmountCents: totalAmount,
      unmatchedInvoices: unmatched,
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
