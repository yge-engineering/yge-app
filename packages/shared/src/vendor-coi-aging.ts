// Subcontractor COI aging.
//
// Plain English: every sub on a public-works job needs a current
// Certificate of Insurance on file. If the COI lapses while the
// sub is on site and something happens, that's a hole in YGE's
// own bond + an exposure on the prime contract. This walks the
// SUBCONTRACTOR vendor list and buckets them by COI freshness so
// the office can chase the expiring ones before a foreman lets
// the sub start work.
//
// Per row: vendorId, vendorName, coiOnFile, coiExpiresOn,
// daysToExpiry (negative = past due), tier:
//   EXPIRED          — coiExpiresOn < today
//   EXPIRES_SOON     — within 30 days
//   CURRENT          — > 30 days out
//   NO_COI           — coiOnFile false (or no expiry recorded)
// onHold flag (sub already paused for any reason).
//
// Sort: EXPIRED first, then EXPIRES_SOON ascending by daysToExpiry,
// then CURRENT, then NO_COI.
//
// Different from vendor-w9-chase (W-9 1099 chase),
// vendor-prequal (full prequal checklist),
// cert-watchlist (employee certs), and cert-renewal-calendar.
// This is the COI-only view.
//
// Pure derivation. No persisted records.

import type { Vendor } from './vendor';

export type VendorCoiTier =
  | 'EXPIRED'
  | 'EXPIRES_SOON'
  | 'CURRENT'
  | 'NO_COI';

export interface VendorCoiAgingRow {
  vendorId: string;
  vendorName: string;
  coiOnFile: boolean;
  coiExpiresOn: string | null;
  daysToExpiry: number | null;
  tier: VendorCoiTier;
  onHold: boolean;
}

export interface VendorCoiAgingRollup {
  subsConsidered: number;
  expired: number;
  expiresSoon: number;
  current: number;
  noCoi: number;
}

export interface VendorCoiAgingInputs {
  vendors: Vendor[];
  /** Reference date as yyyy-mm-dd. Defaults to today. */
  asOf?: string;
  /** "Expires soon" window in days. Defaults to 30. */
  soonDays?: number;
}

export function buildVendorCoiAging(
  inputs: VendorCoiAgingInputs,
): {
  rollup: VendorCoiAgingRollup;
  rows: VendorCoiAgingRow[];
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const soonDays = inputs.soonDays ?? 30;

  const rows: VendorCoiAgingRow[] = [];
  let expired = 0;
  let soon = 0;
  let current = 0;
  let none = 0;

  for (const v of inputs.vendors) {
    if (v.kind !== 'SUBCONTRACTOR') continue;
    let tier: VendorCoiTier;
    let days: number | null;
    if (!v.coiOnFile || !v.coiExpiresOn) {
      tier = 'NO_COI';
      days = null;
      none += 1;
    } else {
      days = daysBetween(asOf, v.coiExpiresOn);
      if (days < 0) {
        tier = 'EXPIRED';
        expired += 1;
      } else if (days <= soonDays) {
        tier = 'EXPIRES_SOON';
        soon += 1;
      } else {
        tier = 'CURRENT';
        current += 1;
      }
    }
    rows.push({
      vendorId: v.id,
      vendorName: vendorDisplay(v),
      coiOnFile: v.coiOnFile,
      coiExpiresOn: v.coiExpiresOn ?? null,
      daysToExpiry: days,
      tier,
      onHold: !!v.onHold,
    });
  }

  rows.sort((a, b) => {
    const order: Record<VendorCoiTier, number> = {
      EXPIRED: 0, EXPIRES_SOON: 1, CURRENT: 2, NO_COI: 3,
    };
    if (order[a.tier] !== order[b.tier]) return order[a.tier] - order[b.tier];
    if (a.daysToExpiry == null && b.daysToExpiry == null) return 0;
    if (a.daysToExpiry == null) return 1;
    if (b.daysToExpiry == null) return -1;
    return a.daysToExpiry - b.daysToExpiry;
  });

  return {
    rollup: {
      subsConsidered: rows.length,
      expired,
      expiresSoon: soon,
      current,
      noCoi: none,
    },
    rows,
  };
}

function vendorDisplay(v: Vendor): string {
  if (v.dbaName && v.dbaName.trim()) return v.dbaName;
  return v.legalName;
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = Date.parse(fromYmd + 'T00:00:00Z');
  const b = Date.parse(toYmd + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}
