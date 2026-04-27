// Per-vendor 1099-NEC readiness check.
//
// Plain English: vendor-1099 produces the year-end 1099 totals.
// This module is the cure-list version — for every vendor that's
// going to need a 1099-NEC filed, what's still missing on their
// record? Address? Tax ID? Current W-9?
//
// IRS 1099-NEC filing requires per vendor:
//   - legal name (always present in vendor master)
//   - tax ID (EIN or SSN)
//   - address (line + city + state + zip)
//   - current W-9 backing the above (3-year refresh window)
//
// The penalty for filing a 1099 with missing or wrong data ranges
// from $60 to $310 per form depending on how late the cure is.
// This list lets Brook fix everything in November before the
// January filing window.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Vendor } from './vendor';
import { vendorW9Current } from './vendor';

export type ReadinessGap =
  | 'NO_W9'
  | 'STALE_W9'
  | 'NO_TAX_ID'
  | 'NO_ADDRESS_LINE'
  | 'NO_CITY'
  | 'NO_STATE'
  | 'NO_ZIP';

export interface VendorReadinessRow {
  vendorId: string;
  vendorName: string;
  ytdPaidCents: number;
  /** True iff every required item is in place. */
  ready: boolean;
  gaps: ReadinessGap[];
}

export interface VendorReadinessRollup {
  vendorsConsidered: number;
  readyCount: number;
  notReadyCount: number;
  /** Sum of YTD paid across NOT-ready vendors — total dollars
   *  still un-curable as 1099 backup. */
  unsupportedCents: number;
}

export interface VendorReadinessInputs {
  asOf?: string;
  /** Year for YTD spend window. Defaults to year of asOf. */
  year?: number;
  vendors: Vendor[];
  apInvoices: ApInvoice[];
  /** $600 IRS 1099-NEC threshold — caller can override. */
  thresholdCents?: number;
}

export function buildVendor1099Readiness(
  inputs: VendorReadinessInputs,
): {
  rollup: VendorReadinessRollup;
  rows: VendorReadinessRow[];
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const year = inputs.year ?? Number(asOf.slice(0, 4));
  const refNow = new Date(`${asOf}T00:00:00Z`);
  const thresholdCents = inputs.thresholdCents ?? 600_00;

  // Vendor lookup by normalized name.
  const byName = new Map<string, Vendor>();
  for (const v of inputs.vendors) {
    if (!v.is1099Reportable) continue;
    byName.set(normalize(v.legalName), v);
    if (v.dbaName) byName.set(normalize(v.dbaName), v);
  }

  // Aggregate YTD paid per vendor.
  const ytdByVendor = new Map<string, number>();
  for (const inv of inputs.apInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'REJECTED') continue;
    if (!inv.invoiceDate.startsWith(`${year}-`)) continue;
    const v = byName.get(normalize(inv.vendorName));
    if (!v) continue;
    ytdByVendor.set(v.id, (ytdByVendor.get(v.id) ?? 0) + inv.paidCents);
  }

  const rows: VendorReadinessRow[] = [];
  let readyCount = 0;
  let notReadyCount = 0;
  let unsupportedCents = 0;

  for (const v of inputs.vendors) {
    if (!v.is1099Reportable) continue;
    const ytd = ytdByVendor.get(v.id) ?? 0;
    if (ytd < thresholdCents) continue;

    const gaps: ReadinessGap[] = [];
    if (!v.w9OnFile) gaps.push('NO_W9');
    else if (!vendorW9Current(v, refNow)) gaps.push('STALE_W9');
    if (!v.taxId || v.taxId.trim().length === 0) gaps.push('NO_TAX_ID');
    if (!v.addressLine || v.addressLine.trim().length === 0) gaps.push('NO_ADDRESS_LINE');
    if (!v.city || v.city.trim().length === 0) gaps.push('NO_CITY');
    if (!v.state || v.state.trim().length === 0) gaps.push('NO_STATE');
    if (!v.zip || v.zip.trim().length === 0) gaps.push('NO_ZIP');

    const ready = gaps.length === 0;
    rows.push({
      vendorId: v.id,
      vendorName: v.dbaName ?? v.legalName,
      ytdPaidCents: ytd,
      ready,
      gaps,
    });
    if (ready) readyCount += 1;
    else {
      notReadyCount += 1;
      unsupportedCents += ytd;
    }
  }

  // Not-ready first (sorted by YTD desc to surface biggest dollars
  // at risk), then ready vendors (also desc).
  rows.sort((a, b) => {
    if (a.ready !== b.ready) return a.ready ? 1 : -1;
    return b.ytdPaidCents - a.ytdPaidCents;
  });

  return {
    rollup: {
      vendorsConsidered: rows.length,
      readyCount,
      notReadyCount,
      unsupportedCents,
    },
    rows,
  };
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,'"`]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(llc|inc|incorporated|corp|corporation|co|company|ltd|limited)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
