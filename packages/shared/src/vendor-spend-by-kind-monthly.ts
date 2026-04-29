// Per (VendorKind, month) AP spend.
//
// Plain English: bucket AP invoices by (VendorKind, yyyy-mm of
// invoiceDate) — long-format. Useful for the "subcontractor
// spend climbed in Q2" style trend.
//
// Per row: kind, month, totalCents, invoiceCount,
// distinctVendors.
//
// Sort: kind asc, month asc.
//
// Different from vendor-spend-by-kind (per-kind, no month axis),
// vendor-spend-monthly (per-vendor per-month).
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Vendor, VendorKind } from './vendor';

export interface VendorSpendByKindMonthlyRow {
  kind: VendorKind;
  month: string;
  totalCents: number;
  invoiceCount: number;
  distinctVendors: number;
}

export interface VendorSpendByKindMonthlyRollup {
  kindsConsidered: number;
  monthsConsidered: number;
  totalCents: number;
  unmatchedInvoices: number;
}

export interface VendorSpendByKindMonthlyInputs {
  vendors: Vendor[];
  apInvoices: ApInvoice[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildVendorSpendByKindMonthly(
  inputs: VendorSpendByKindMonthlyInputs,
): {
  rollup: VendorSpendByKindMonthlyRollup;
  rows: VendorSpendByKindMonthlyRow[];
} {
  const kindByKey = new Map<string, VendorKind>();
  for (const v of inputs.vendors) {
    if (v.legalName) kindByKey.set(canonicalize(v.legalName), v.kind);
    if (v.dbaName) kindByKey.set(canonicalize(v.dbaName), v.kind);
  }

  type Acc = {
    kind: VendorKind;
    month: string;
    cents: number;
    invoices: number;
    vendors: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const kindSet = new Set<VendorKind>();
  const monthSet = new Set<string>();
  let totalCents = 0;
  let unmatched = 0;

  for (const inv of inputs.apInvoices) {
    const month = inv.invoiceDate.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const canonical = canonicalize(inv.vendorName);
    const kind = kindByKey.get(canonical);
    if (!kind) {
      unmatched += 1;
      continue;
    }
    const key = `${kind}|${month}`;
    const acc = accs.get(key) ?? {
      kind,
      month,
      cents: 0,
      invoices: 0,
      vendors: new Set<string>(),
    };
    acc.cents += inv.totalCents;
    acc.invoices += 1;
    acc.vendors.add(canonical);
    accs.set(key, acc);
    kindSet.add(kind);
    monthSet.add(month);
    totalCents += inv.totalCents;
  }

  const rows: VendorSpendByKindMonthlyRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      kind: acc.kind,
      month: acc.month,
      totalCents: acc.cents,
      invoiceCount: acc.invoices,
      distinctVendors: acc.vendors.size,
    });
  }

  rows.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    return a.month.localeCompare(b.month);
  });

  return {
    rollup: {
      kindsConsidered: kindSet.size,
      monthsConsidered: monthSet.size,
      totalCents,
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
