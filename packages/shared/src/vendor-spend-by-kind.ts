// Vendor AP spend by vendor kind.
//
// Plain English: roll AP invoice \$ up by vendor kind
// (SUPPLIER, SUBCONTRACTOR, EQUIPMENT_RENTAL, TRUCKING,
// PROFESSIONAL, UTILITY, GOVERNMENT, OTHER). The mix shows where
// the cash actually goes — heavy civil tends to be heavy on
// SUBCONTRACTOR + SUPPLIER + EQUIPMENT_RENTAL. Helps validate
// pursuit estimates ("we said 30% subcontracted, are we
// actually at 30%?") and surfaces creep into PROFESSIONAL or
// UTILITY categories that were under-estimated.
//
// Per row: kind, vendorCount (in registry), invoiceCount,
// totalAmountCents, avgInvoiceCents, share (of total AP \$).
//
// Sort by totalAmountCents desc.
//
// Different from vendor-spend (per-vendor totals),
// vendor-concentration (per-vendor share of total),
// vendor-payment-terms-mix (by paymentTerms).
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Vendor, VendorKind } from './vendor';

export interface VendorSpendByKindRow {
  kind: VendorKind;
  vendorCount: number;
  invoiceCount: number;
  totalAmountCents: number;
  avgInvoiceCents: number;
  share: number;
}

export interface VendorSpendByKindRollup {
  kindsConsidered: number;
  totalVendors: number;
  totalInvoices: number;
  totalAmountCents: number;
  unmatchedInvoices: number;
}

export interface VendorSpendByKindInputs {
  vendors: Vendor[];
  apInvoices: ApInvoice[];
  /** Optional yyyy-mm-dd window applied to invoiceDate. */
  fromDate?: string;
  toDate?: string;
}

export function buildVendorSpendByKind(
  inputs: VendorSpendByKindInputs,
): {
  rollup: VendorSpendByKindRollup;
  rows: VendorSpendByKindRow[];
} {
  const kindByKey = new Map<string, VendorKind>();
  const vendorCountByKind = new Map<VendorKind, number>();
  for (const v of inputs.vendors) {
    if (v.legalName) kindByKey.set(canonicalize(v.legalName), v.kind);
    if (v.dbaName) kindByKey.set(canonicalize(v.dbaName), v.kind);
    vendorCountByKind.set(v.kind, (vendorCountByKind.get(v.kind) ?? 0) + 1);
  }

  type Acc = { invoices: number; amount: number };
  const accs = new Map<VendorKind, Acc>();
  let unmatched = 0;
  let totalAmount = 0;
  let totalInvoices = 0;

  for (const inv of inputs.apInvoices) {
    if (inputs.fromDate && inv.invoiceDate < inputs.fromDate) continue;
    if (inputs.toDate && inv.invoiceDate > inputs.toDate) continue;
    totalInvoices += 1;
    totalAmount += inv.totalCents;
    const key = canonicalize(inv.vendorName);
    const kind = kindByKey.get(key);
    if (!kind) {
      unmatched += 1;
      continue;
    }
    const acc = accs.get(kind) ?? { invoices: 0, amount: 0 };
    acc.invoices += 1;
    acc.amount += inv.totalCents;
    accs.set(kind, acc);
  }

  const rows: VendorSpendByKindRow[] = [];
  for (const [kind, acc] of accs.entries()) {
    const avg = acc.invoices === 0 ? 0 : Math.round(acc.amount / acc.invoices);
    const share = totalAmount === 0
      ? 0
      : Math.round((acc.amount / totalAmount) * 10_000) / 10_000;
    rows.push({
      kind,
      vendorCount: vendorCountByKind.get(kind) ?? 0,
      invoiceCount: acc.invoices,
      totalAmountCents: acc.amount,
      avgInvoiceCents: avg,
      share,
    });
  }

  rows.sort((a, b) => b.totalAmountCents - a.totalAmountCents);

  return {
    rollup: {
      kindsConsidered: rows.length,
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
