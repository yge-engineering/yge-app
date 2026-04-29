// Vendor on-hold list with YTD spend.
//
// Plain English: any vendor on hold is a payment pause. Some are
// short-term (waiting on a corrected invoice); some are long-term
// (CSLB issue, bond claim). Show the on-hold list with their YTD
// AP \$ alongside so the bookkeeper can prioritize follow-ups.
//
// Per row: vendorId, vendorName, kind, state, ytdSpendCents,
// ytdInvoiceCount, lastInvoiceDate.
//
// Sort by ytdSpendCents desc.
//
// Different from vendor-onhold-exposure (open AP balance per
// on-hold vendor) and vendor-prequal (full prequal). This is the
// follow-up priority list.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Vendor, VendorKind } from './vendor';

export interface VendorOnHoldRow {
  vendorId: string;
  vendorName: string;
  kind: VendorKind;
  state: string | null;
  ytdSpendCents: number;
  ytdInvoiceCount: number;
  lastInvoiceDate: string | null;
}

export interface VendorOnHoldRollup {
  onHoldCount: number;
  totalYtdSpendCents: number;
}

export interface VendorOnHoldInputs {
  vendors: Vendor[];
  apInvoices: ApInvoice[];
  /** YTD start. Defaults to Jan 1 of current year. */
  ytdStart?: string;
}

export function buildVendorOnHoldList(
  inputs: VendorOnHoldInputs,
): {
  rollup: VendorOnHoldRollup;
  rows: VendorOnHoldRow[];
} {
  const ytdStart = inputs.ytdStart ?? `${new Date().getUTCFullYear()}-01-01`;

  const onHoldVendors = inputs.vendors.filter((v) => v.onHold);
  const nameKeys = new Map<string, string>(); // canonical name → vendorId
  for (const v of onHoldVendors) {
    if (v.legalName) nameKeys.set(canonicalize(v.legalName), v.id);
    if (v.dbaName) nameKeys.set(canonicalize(v.dbaName), v.id);
  }

  type Spend = { spend: number; count: number; lastDate: string | null };
  const spendById = new Map<string, Spend>();
  for (const v of onHoldVendors) spendById.set(v.id, { spend: 0, count: 0, lastDate: null });

  for (const inv of inputs.apInvoices) {
    if (inv.invoiceDate < ytdStart) continue;
    const id = nameKeys.get(canonicalize(inv.vendorName));
    if (!id) continue;
    const acc = spendById.get(id);
    if (!acc) continue;
    acc.spend += inv.totalCents;
    acc.count += 1;
    if (!acc.lastDate || inv.invoiceDate > acc.lastDate) acc.lastDate = inv.invoiceDate;
  }

  const rows: VendorOnHoldRow[] = [];
  let totalSpend = 0;

  for (const v of onHoldVendors) {
    const s = spendById.get(v.id) ?? { spend: 0, count: 0, lastDate: null };
    const display = (v.dbaName && v.dbaName.trim()) ? v.dbaName : v.legalName;
    rows.push({
      vendorId: v.id,
      vendorName: display,
      kind: v.kind,
      state: v.state ?? null,
      ytdSpendCents: s.spend,
      ytdInvoiceCount: s.count,
      lastInvoiceDate: s.lastDate,
    });
    totalSpend += s.spend;
  }

  rows.sort((a, b) => b.ytdSpendCents - a.ytdSpendCents);

  return {
    rollup: {
      onHoldCount: rows.length,
      totalYtdSpendCents: totalSpend,
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
