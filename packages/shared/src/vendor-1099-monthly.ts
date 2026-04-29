// Per-vendor 1099 YTD progression by month.
//
// Plain English: for every 1099-reportable vendor, build a
// month-by-month YTD spend curve. Use this to spot vendors
// crossing the IRS \$600 threshold mid-year so the W-9 chase can
// happen before October.
//
// Per row: vendorName, month, monthlyCents, ytdCents,
// crossedThreshold (true once ytdCents >= 600 * 100).
//
// Sort: vendorName asc, month asc.
//
// Different from vendor-1099-ytd-threshold (snapshot list at a
// given asOf), vendor-1099-readiness (per-vendor checklist),
// vendor-w9-chase (chase priority).
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Vendor } from './vendor';

const IRS_1099_THRESHOLD_CENTS = 600 * 100;

export interface Vendor1099MonthlyRow {
  vendorId: string;
  vendorName: string;
  month: string;
  monthlyCents: number;
  ytdCents: number;
  crossedThreshold: boolean;
}

export interface Vendor1099MonthlyRollup {
  vendorsConsidered: number;
  monthsConsidered: number;
  thresholdCrossings: number;
}

export interface Vendor1099MonthlyInputs {
  vendors: Vendor[];
  apInvoices: ApInvoice[];
  /** YTD start. Defaults to Jan 1 of current year. */
  ytdStart?: string;
  /** Optional yyyy-mm cap. Defaults to current month. */
  toMonth?: string;
}

export function buildVendor1099Monthly(
  inputs: Vendor1099MonthlyInputs,
): {
  rollup: Vendor1099MonthlyRollup;
  rows: Vendor1099MonthlyRow[];
} {
  const ytdStart = inputs.ytdStart ?? `${new Date().getUTCFullYear()}-01-01`;
  const toMonth = inputs.toMonth ?? new Date().toISOString().slice(0, 7);

  const reportable = inputs.vendors.filter((v) => v.is1099Reportable);
  const idByName = new Map<string, string>();
  const nameById = new Map<string, string>();
  for (const v of reportable) {
    const display = (v.dbaName && v.dbaName.trim()) ? v.dbaName : v.legalName;
    nameById.set(v.id, display);
    if (v.legalName) idByName.set(canonicalize(v.legalName), v.id);
    if (v.dbaName) idByName.set(canonicalize(v.dbaName), v.id);
  }

  // (vendorId, month) → cents
  const monthly = new Map<string, number>();
  const monthSet = new Set<string>();

  for (const inv of inputs.apInvoices) {
    if (inv.invoiceDate < ytdStart) continue;
    const month = inv.invoiceDate.slice(0, 7);
    if (month > toMonth) continue;
    const id = idByName.get(canonicalize(inv.vendorName));
    if (!id) continue;
    const key = `${id}|${month}`;
    monthly.set(key, (monthly.get(key) ?? 0) + inv.totalCents);
    monthSet.add(month);
  }

  const rows: Vendor1099MonthlyRow[] = [];
  let crossings = 0;

  for (const v of reportable) {
    let ytd = 0;
    let alreadyCrossed = false;
    const months = Array.from(monthSet).sort();
    for (const month of months) {
      const monthlyCents = monthly.get(`${v.id}|${month}`) ?? 0;
      if (monthlyCents === 0) continue;
      ytd += monthlyCents;
      const crossedThreshold = ytd >= IRS_1099_THRESHOLD_CENTS;
      if (crossedThreshold && !alreadyCrossed) {
        crossings += 1;
        alreadyCrossed = true;
      }
      rows.push({
        vendorId: v.id,
        vendorName: nameById.get(v.id) ?? v.legalName,
        month,
        monthlyCents,
        ytdCents: ytd,
        crossedThreshold,
      });
    }
  }

  rows.sort((a, b) => {
    if (a.vendorName !== b.vendorName) return a.vendorName.localeCompare(b.vendorName);
    return a.month.localeCompare(b.month);
  });

  return {
    rollup: {
      vendorsConsidered: reportable.length,
      monthsConsidered: monthSet.size,
      thresholdCrossings: crossings,
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
