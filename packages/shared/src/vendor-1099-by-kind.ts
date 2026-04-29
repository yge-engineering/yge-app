// Vendor 1099-NEC YTD spend rolled up by VendorKind.
//
// Plain English: take the list of 1099-flagged vendors plus
// year-to-date AP payments, then bucket the totals by vendor
// kind (SUBCONTRACTOR / TRUCKING / PROFESSIONAL / etc.).
// Tells the bookkeeper which vendor *segments* dominate the
// year-end 1099 mailing so chasing missing W-9s can be
// triaged by category, not just one giant list.
//
// Per row: kind, vendorsConsidered, reportableCount,
// overThresholdCount, missingW9Count, totalReportableCents.
//
// Sort: totalReportableCents desc, then kind asc.
//
// Different from vendor-1099 (per-vendor row),
// vendor-1099-readiness (per-vendor tier),
// vendor-1099-status-mix (tier mix portfolio-wide),
// vendor-1099-monthly (per-month YTD trend).
//
// Pure derivation. No persisted records.

import type { ApPayment } from './ap-payment';
import { type Vendor, type VendorKind, vendorW9Current } from './vendor';
import { DEFAULT_1099_NEC_THRESHOLD_CENTS } from './vendor-1099';

export interface Vendor1099ByKindRow {
  kind: VendorKind;
  vendorsConsidered: number;
  reportableCount: number;
  overThresholdCount: number;
  missingW9Count: number;
  totalReportableCents: number;
}

export interface Vendor1099ByKindRollup {
  year: number;
  thresholdCents: number;
  kindsConsidered: number;
  totalReportableVendors: number;
  totalOverThreshold: number;
  totalMissingW9: number;
  totalReportableCents: number;
}

export interface Vendor1099ByKindInputs {
  year: number;
  vendors: Vendor[];
  payments: ApPayment[];
  thresholdCents?: number;
  asOf?: Date;
}

function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(llc|inc|corp|co|ltd|company)\b/g, '')
    .replace(/[.,&'()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildVendor1099ByKind(
  inputs: Vendor1099ByKindInputs,
): {
  rollup: Vendor1099ByKindRollup;
  rows: Vendor1099ByKindRow[];
} {
  const thresholdCents =
    inputs.thresholdCents ?? DEFAULT_1099_NEC_THRESHOLD_CENTS;
  const asOf = inputs.asOf ?? new Date();
  const yearStart = `${inputs.year}-01-01`;
  const yearEnd = `${inputs.year}-12-31`;

  // Sum AP cents per normalized vendor name in the year.
  const ytdByName = new Map<string, number>();
  for (const p of inputs.payments) {
    if (p.voided) continue;
    if (p.paidOn < yearStart || p.paidOn > yearEnd) continue;
    const k = normName(p.vendorName);
    ytdByName.set(k, (ytdByName.get(k) ?? 0) + p.amountCents);
  }

  type Acc = {
    kind: VendorKind;
    vendorsConsidered: number;
    reportableCount: number;
    overThresholdCount: number;
    missingW9Count: number;
    totalReportableCents: number;
  };
  const accs = new Map<VendorKind, Acc>();
  function get(k: VendorKind): Acc {
    let a = accs.get(k);
    if (!a) {
      a = {
        kind: k,
        vendorsConsidered: 0,
        reportableCount: 0,
        overThresholdCount: 0,
        missingW9Count: 0,
        totalReportableCents: 0,
      };
      accs.set(k, a);
    }
    return a;
  }

  for (const v of inputs.vendors) {
    const a = get(v.kind);
    a.vendorsConsidered += 1;

    if (!v.is1099Reportable) continue;
    a.reportableCount += 1;

    const ytd = ytdByName.get(normName(v.legalName)) ?? 0;
    a.totalReportableCents += ytd;

    if (ytd >= thresholdCents) {
      a.overThresholdCount += 1;
      if (!vendorW9Current(v, asOf)) {
        a.missingW9Count += 1;
      }
    }
  }

  const rows = [...accs.values()].sort((x, y) => {
    if (x.totalReportableCents !== y.totalReportableCents) {
      return y.totalReportableCents - x.totalReportableCents;
    }
    return x.kind.localeCompare(y.kind);
  });

  let totalReportableVendors = 0;
  let totalOverThreshold = 0;
  let totalMissingW9 = 0;
  let totalReportableCents = 0;
  for (const r of rows) {
    totalReportableVendors += r.reportableCount;
    totalOverThreshold += r.overThresholdCount;
    totalMissingW9 += r.missingW9Count;
    totalReportableCents += r.totalReportableCents;
  }

  return {
    rollup: {
      year: inputs.year,
      thresholdCents,
      kindsConsidered: rows.length,
      totalReportableVendors,
      totalOverThreshold,
      totalMissingW9,
      totalReportableCents,
    },
    rows,
  };
}
