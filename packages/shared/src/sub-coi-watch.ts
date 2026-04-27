// Subcontractor COI expiration watch.
//
// Plain English: every sub on a YGE jobsite must carry a current
// Certificate of Insurance. Once the COI expires, paying the sub
// without re-collecting one is a real problem — if the sub causes
// damage and we paid them while uninsured, the GC and the owner
// can hold YGE liable for the gap. This walks the SUBCONTRACTOR
// vendor master and surfaces:
//   - subs with no COI on file at all
//   - COIs that expired
//   - COIs expiring within 30 days (warn now)
//   - dollar exposure: pending/approved AP invoices already in flight
//     to subs in those buckets
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Vendor } from './vendor';

export type CoiWatchFlag =
  | 'CURRENT'         // COI on file and >30 days from expiry
  | 'EXPIRING_SOON'   // 0-30 days from expiry
  | 'EXPIRED'         // expired or no expiry tracked but flagged
  | 'NO_COI';         // not on file at all

export interface CoiWatchRow {
  vendorId: string;
  vendorName: string;
  coiOnFile: boolean;
  coiExpiresOn: string | null;
  daysToExpiry: number | null;
  flag: CoiWatchFlag;
  /** Sum of unpaid AP balance to this sub (PENDING + APPROVED). */
  unpaidExposureCents: number;
  /** Sum of paidCents YTD — to flag "we just paid them and they're
   *  uninsured" cases for retroactive cure letters. */
  recentPaidCents: number;
}

export interface CoiWatchRollup {
  subsConsidered: number;
  current: number;
  expiringSoon: number;
  expired: number;
  noCoi: number;
  /** Total unpaidExposureCents across EXPIRED + NO_COI rows. */
  blockedExposureCents: number;
  /** Total recentPaidCents across EXPIRED + NO_COI rows. */
  paidWhileUninsuredCents: number;
}

export interface CoiWatchInputs {
  asOf?: string;
  vendors: Vendor[];
  apInvoices: ApInvoice[];
  /** Optional yyyy-mm-dd window for the "recent paid" rollup.
   *  Defaults to YTD of asOf. */
  recentSince?: string;
}

export function buildSubCoiWatch(inputs: CoiWatchInputs): {
  rollup: CoiWatchRollup;
  rows: CoiWatchRow[];
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const refNow = new Date(`${asOf}T00:00:00Z`);
  const recentSince = inputs.recentSince ?? `${asOf.slice(0, 4)}-01-01`;

  // Vendor name lookup so we can match AP invoices.
  const subs = inputs.vendors.filter((v) => v.kind === 'SUBCONTRACTOR');
  const byName = new Map<string, Vendor>();
  for (const v of subs) {
    byName.set(normalize(v.legalName), v);
    if (v.dbaName) byName.set(normalize(v.dbaName), v);
  }

  const unpaidByVendor = new Map<string, number>();
  const recentPaidByVendor = new Map<string, number>();
  for (const inv of inputs.apInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'REJECTED') continue;
    const v = byName.get(normalize(inv.vendorName));
    if (!v) continue;
    if (inv.status === 'PENDING' || inv.status === 'APPROVED') {
      const unpaid = Math.max(0, inv.totalCents - inv.paidCents);
      unpaidByVendor.set(v.id, (unpaidByVendor.get(v.id) ?? 0) + unpaid);
    }
    if (inv.invoiceDate >= recentSince && inv.invoiceDate <= asOf) {
      recentPaidByVendor.set(v.id, (recentPaidByVendor.get(v.id) ?? 0) + inv.paidCents);
    }
  }

  const rows: CoiWatchRow[] = [];
  const counts = { current: 0, expiringSoon: 0, expired: 0, noCoi: 0 };
  let blockedExposure = 0;
  let paidWhileUninsured = 0;

  for (const v of subs) {
    let flag: CoiWatchFlag;
    let daysToExpiry: number | null = null;

    if (!v.coiOnFile) {
      flag = 'NO_COI';
    } else if (!v.coiExpiresOn) {
      // On file but expiry not tracked — treat as CURRENT (we don't
      // have a date to fail on).
      flag = 'CURRENT';
    } else {
      const expDate = parseDate(v.coiExpiresOn);
      if (!expDate) {
        flag = 'CURRENT';
      } else {
        daysToExpiry = daysBetween(refNow, expDate);
        if (daysToExpiry < 0) flag = 'EXPIRED';
        else if (daysToExpiry <= 30) flag = 'EXPIRING_SOON';
        else flag = 'CURRENT';
      }
    }

    const unpaid = unpaidByVendor.get(v.id) ?? 0;
    const paid = recentPaidByVendor.get(v.id) ?? 0;
    rows.push({
      vendorId: v.id,
      vendorName: v.dbaName ?? v.legalName,
      coiOnFile: v.coiOnFile,
      coiExpiresOn: v.coiExpiresOn ?? null,
      daysToExpiry,
      flag,
      unpaidExposureCents: unpaid,
      recentPaidCents: paid,
    });

    if (flag === 'CURRENT') counts.current += 1;
    else if (flag === 'EXPIRING_SOON') counts.expiringSoon += 1;
    else if (flag === 'EXPIRED') counts.expired += 1;
    else counts.noCoi += 1;
    if (flag === 'EXPIRED' || flag === 'NO_COI') {
      blockedExposure += unpaid;
      paidWhileUninsured += paid;
    }
  }

  // Worst (NO_COI / EXPIRED) first; then EXPIRING_SOON; then by
  // unpaid exposure desc to surface the highest-dollar gaps.
  const tierRank: Record<CoiWatchFlag, number> = {
    EXPIRED: 0,
    NO_COI: 1,
    EXPIRING_SOON: 2,
    CURRENT: 3,
  };
  rows.sort((a, b) => {
    if (a.flag !== b.flag) return tierRank[a.flag] - tierRank[b.flag];
    return b.unpaidExposureCents - a.unpaidExposureCents;
  });

  return {
    rollup: {
      subsConsidered: rows.length,
      current: counts.current,
      expiringSoon: counts.expiringSoon,
      expired: counts.expired,
      noCoi: counts.noCoi,
      blockedExposureCents: blockedExposure,
      paidWhileUninsuredCents: paidWhileUninsured,
    },
    rows,
  };
}

function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
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
