// Per-vendor 1099-NEC year-to-date threshold tracker.
//
// Plain English: the IRS 1099-NEC threshold is $600 per calendar
// year per non-corporate vendor. Every year YGE has to file a
// 1099 for every vendor it paid >= $600 for services. This
// module walks AP payments, sums by canonical vendor name,
// and surfaces the YTD running total as of asOf — flagging:
//   - vendors already over threshold
//   - vendors approaching threshold ($500-$600)
//   - vendors over threshold WITHOUT a current W-9 (the 30%
//     backup-withholding trap)
//
// Different from vendor-1099 (year-end summary, calendar year)
// and vendor-1099-readiness (W-9 chase). This is the in-flight
// threshold tracker — used quarterly to make sure the W-9 +
// vendor master is current before December panic.
//
// Pure derivation. No persisted records.

import type { ApPayment } from './ap-payment';
import type { Vendor } from './vendor';

export type ThresholdFlag =
  | 'OVER'             // YTD >= threshold
  | 'APPROACHING'      // 80-100% of threshold
  | 'BELOW';           // < 80%

export interface Vendor1099ThresholdRow {
  vendorName: string;
  /** Matched vendor master id. Null when the AP payment's
   *  vendorName doesn't resolve to a Vendor record. */
  vendorId: string | null;
  is1099Reportable: boolean;
  paidYtdCents: number;
  /** True if Vendor master has a current W-9 (vendorW9Current
   *  helper would compute this; we read .w9CurrentlyOnFile or
   *  similar — schema-dependent). For Phase 1 we read the
   *  Vendor.is1099Reportable + presence of taxId as a proxy. */
  hasTaxId: boolean;
  flag: ThresholdFlag;
  /** When OVER + (no taxId OR not flagged 1099-reportable): the
   *  bookkeeper has a problem to fix. */
  needsW9Chase: boolean;
}

export interface Vendor1099ThresholdRollup {
  vendorsConsidered: number;
  totalPaidCents: number;
  overThresholdCount: number;
  approachingCount: number;
  needsW9ChaseCount: number;
}

export interface Vendor1099ThresholdInputs {
  apPayments: ApPayment[];
  vendors: Vendor[];
  /** Threshold in cents. Default 60000 ($600). */
  thresholdCents?: number;
  /** Window — typically the calendar year start to asOf. */
  fromDate?: string;
  toDate?: string;
}

export function buildVendor1099Threshold(
  inputs: Vendor1099ThresholdInputs,
): {
  rollup: Vendor1099ThresholdRollup;
  rows: Vendor1099ThresholdRow[];
} {
  const threshold = inputs.thresholdCents ?? 60_000;

  // Vendor name → master record.
  const byName = new Map<string, Vendor>();
  for (const v of inputs.vendors) {
    byName.set(canonicalize(v.legalName), v);
    if (v.dbaName) byName.set(canonicalize(v.dbaName), v);
  }

  // Walk AP payments, sum per canonical name, skipping voided.
  const totals = new Map<string, number>();
  const displayNames = new Map<string, string>();
  for (const p of inputs.apPayments) {
    if (p.voided) continue;
    if (inputs.fromDate && p.paidOn < inputs.fromDate) continue;
    if (inputs.toDate && p.paidOn > inputs.toDate) continue;
    const key = canonicalize(p.vendorName);
    totals.set(key, (totals.get(key) ?? 0) + p.amountCents);
    if (!displayNames.has(key)) displayNames.set(key, p.vendorName);
  }

  let totalPaid = 0;
  let overCount = 0;
  let approachingCount = 0;
  let chaseCount = 0;

  const rows: Vendor1099ThresholdRow[] = [];
  for (const [key, amount] of totals.entries()) {
    const vendor = byName.get(key);
    const flag: ThresholdFlag =
      amount >= threshold ? 'OVER' :
      amount >= threshold * 0.8 ? 'APPROACHING' :
      'BELOW';
    const hasTaxId = !!vendor?.taxId;
    const isReportable = vendor?.is1099Reportable === true;
    const needsW9Chase = flag === 'OVER' && (!isReportable || !hasTaxId);

    rows.push({
      vendorName: displayNames.get(key) ?? key,
      vendorId: vendor?.id ?? null,
      is1099Reportable: isReportable,
      paidYtdCents: amount,
      hasTaxId,
      flag,
      needsW9Chase,
    });

    totalPaid += amount;
    if (flag === 'OVER') overCount += 1;
    if (flag === 'APPROACHING') approachingCount += 1;
    if (needsW9Chase) chaseCount += 1;
  }

  // Sort: needsW9Chase first, then OVER, then APPROACHING, then BELOW
  // by amount desc.
  const tier: Record<ThresholdFlag, number> = { OVER: 0, APPROACHING: 1, BELOW: 2 };
  rows.sort((a, b) => {
    if (a.needsW9Chase !== b.needsW9Chase) return a.needsW9Chase ? -1 : 1;
    if (a.flag !== b.flag) return tier[a.flag] - tier[b.flag];
    return b.paidYtdCents - a.paidYtdCents;
  });

  return {
    rollup: {
      vendorsConsidered: rows.length,
      totalPaidCents: totalPaid,
      overThresholdCount: overCount,
      approachingCount,
      needsW9ChaseCount: chaseCount,
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
