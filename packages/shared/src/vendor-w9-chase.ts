// Vendor W-9 chase list.
//
// Plain English: every vendor we pay $600+ for services in a calendar
// year needs a 1099-NEC at year-end. The IRS wants the EIN on the
// 1099, which means we need a current W-9 from the vendor.
//
// This walks the vendor master + AP invoices and surfaces vendors who
//   1. are flagged 1099-reportable, AND
//   2. have YTD spend at or near the threshold, AND
//   3. don't have a current W-9 on file.
//
// Three urgency tiers:
//   OVER_THRESHOLD_NO_W9  — already past $600, no W-9 — REAL problem
//   APPROACHING_NO_W9     — within 80% of threshold, no W-9 — chase now
//   REPORTABLE_NO_W9      — flagged 1099-reportable but never paid
//                           enough to matter yet
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Vendor } from './vendor';
import { vendorW9Current } from './vendor';

export type W9ChaseTier =
  | 'OVER_THRESHOLD_NO_W9'
  | 'APPROACHING_NO_W9'
  | 'REPORTABLE_NO_W9';

export interface VendorW9ChaseRow {
  vendorId: string;
  vendorName: string;
  ytdSpendCents: number;
  invoiceCount: number;
  thresholdCents: number;
  /** True iff the W-9 is on file AND collected within the last 3y. */
  w9Current: boolean;
  /** True iff the W-9 is on file (regardless of age). */
  w9OnFile: boolean;
  tier: W9ChaseTier;
}

export interface VendorW9ChaseRollup {
  total: number;
  overThreshold: number;
  approaching: number;
  reportable: number;
  /** Sum of ytdSpendCents for OVER_THRESHOLD_NO_W9 rows. */
  overThresholdSpendCents: number;
}

export interface VendorW9ChaseInputs {
  /** ISO yyyy-mm-dd; defaults to today (UTC). */
  asOf?: string;
  /** Calendar year for YTD spend sums. Defaults to year of asOf. */
  year?: number;
  vendors: Vendor[];
  apInvoices: ApInvoice[];
  /** $600 default per IRS 1099-NEC threshold. Caller can override
   *  if Congress moves it. */
  thresholdCents?: number;
  /** "Approaching" threshold as a fraction. Default 0.8. */
  approachingFraction?: number;
}

export function buildVendorW9Chase(inputs: VendorW9ChaseInputs): {
  rows: VendorW9ChaseRow[];
  rollup: VendorW9ChaseRollup;
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const year = inputs.year ?? Number(asOf.slice(0, 4));
  const refNow = new Date(`${asOf}T00:00:00Z`);
  const thresholdCents = inputs.thresholdCents ?? 600_00;
  const approachingFraction = inputs.approachingFraction ?? 0.8;
  const approachingCents = Math.round(thresholdCents * approachingFraction);

  // Sum YTD spend per vendorId. AP invoices reference vendorName
  // (free-form) but most vendors line up either by id or via the
  // Vendor master's legalName / dbaName — we match by normalized
  // name.
  const byNormalizedName = new Map<string, Vendor>();
  for (const v of inputs.vendors) {
    if (!v.is1099Reportable) continue; // not a candidate
    byNormalizedName.set(normalize(v.legalName), v);
    if (v.dbaName) byNormalizedName.set(normalize(v.dbaName), v);
  }

  const ytdByVendorId = new Map<string, { spend: number; count: number }>();
  for (const inv of inputs.apInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'REJECTED') continue;
    if (!inv.invoiceDate.startsWith(`${year}-`)) continue;
    const v = byNormalizedName.get(normalize(inv.vendorName));
    if (!v) continue;
    const cur = ytdByVendorId.get(v.id) ?? { spend: 0, count: 0 };
    cur.spend += inv.totalCents;
    cur.count += 1;
    ytdByVendorId.set(v.id, cur);
  }

  const rows: VendorW9ChaseRow[] = [];
  for (const v of inputs.vendors) {
    if (!v.is1099Reportable) continue;
    const w9Current = vendorW9Current(v, refNow);
    if (w9Current) continue; // not chasing a vendor we already have current for

    const ytd = ytdByVendorId.get(v.id) ?? { spend: 0, count: 0 };
    let tier: W9ChaseTier;
    if (ytd.spend >= thresholdCents) tier = 'OVER_THRESHOLD_NO_W9';
    else if (ytd.spend >= approachingCents) tier = 'APPROACHING_NO_W9';
    else tier = 'REPORTABLE_NO_W9';

    rows.push({
      vendorId: v.id,
      vendorName: v.dbaName ?? v.legalName,
      ytdSpendCents: ytd.spend,
      invoiceCount: ytd.count,
      thresholdCents,
      w9Current,
      w9OnFile: v.w9OnFile,
      tier,
    });
  }

  // Tier order, then highest spend within tier.
  const tierRank: Record<W9ChaseTier, number> = {
    OVER_THRESHOLD_NO_W9: 0,
    APPROACHING_NO_W9: 1,
    REPORTABLE_NO_W9: 2,
  };
  rows.sort((a, b) => {
    if (a.tier !== b.tier) return tierRank[a.tier] - tierRank[b.tier];
    return b.ytdSpendCents - a.ytdSpendCents;
  });

  let overThreshold = 0;
  let approaching = 0;
  let reportable = 0;
  let overThresholdSpendCents = 0;
  for (const r of rows) {
    if (r.tier === 'OVER_THRESHOLD_NO_W9') {
      overThreshold += 1;
      overThresholdSpendCents += r.ytdSpendCents;
    } else if (r.tier === 'APPROACHING_NO_W9') approaching += 1;
    else reportable += 1;
  }

  return {
    rows,
    rollup: {
      total: rows.length,
      overThreshold,
      approaching,
      reportable,
      overThresholdSpendCents,
    },
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
