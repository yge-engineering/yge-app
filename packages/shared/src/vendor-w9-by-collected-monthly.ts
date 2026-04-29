// Per-month W-9 collection cadence.
//
// Plain English: bucket vendors by yyyy-mm of w9CollectedOn.
// Counts how many W-9s the office actually pulled in each
// month. Tracks the seasonal pattern of W-9 chase work — the
// bookkeeper typically pushes hard in Q4 before 1099 mailing
// season and again after onboarding new subs in Q1.
//
// Per row: month, w9sCollected, byKind, reportableSet.
//
// Sort: month asc.
//
// Different from vendor-w9-monthly-expiring (per-month *expiring*
// W-9s, the chase calendar — this is the *collected* cadence,
// the input flow), vendor-w9-chase (current chase list),
// vendor-1099-readiness (per-vendor tier).
//
// Pure derivation. No persisted records.

import type { Vendor, VendorKind } from './vendor';

export interface VendorW9ByCollectedMonthlyRow {
  month: string;
  w9sCollected: number;
  byKind: Partial<Record<VendorKind, number>>;
  reportableCount: number;
}

export interface VendorW9ByCollectedMonthlyRollup {
  monthsConsidered: number;
  totalW9s: number;
  totalReportable: number;
  noCollectedDateSkipped: number;
}

export interface VendorW9ByCollectedMonthlyInputs {
  vendors: Vendor[];
  /** Optional yyyy-mm bounds inclusive applied to w9CollectedOn. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildVendorW9ByCollectedMonthly(
  inputs: VendorW9ByCollectedMonthlyInputs,
): {
  rollup: VendorW9ByCollectedMonthlyRollup;
  rows: VendorW9ByCollectedMonthlyRow[];
} {
  type Acc = {
    month: string;
    w9sCollected: number;
    byKind: Map<VendorKind, number>;
    reportableCount: number;
  };
  const accs = new Map<string, Acc>();
  const months = new Set<string>();

  let totalW9s = 0;
  let totalReportable = 0;
  let noCollectedDateSkipped = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const v of inputs.vendors) {
    if (!v.w9OnFile) continue;
    if (!v.w9CollectedOn || !/^\d{4}-\d{2}/.test(v.w9CollectedOn)) {
      noCollectedDateSkipped += 1;
      continue;
    }
    const month = v.w9CollectedOn.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    let a = accs.get(month);
    if (!a) {
      a = {
        month,
        w9sCollected: 0,
        byKind: new Map(),
        reportableCount: 0,
      };
      accs.set(month, a);
    }
    a.w9sCollected += 1;
    a.byKind.set(v.kind, (a.byKind.get(v.kind) ?? 0) + 1);
    if (v.is1099Reportable) {
      a.reportableCount += 1;
      totalReportable += 1;
    }

    months.add(month);
    totalW9s += 1;
  }

  const rows: VendorW9ByCollectedMonthlyRow[] = [...accs.values()]
    .map((a) => {
      const byKind: Partial<Record<VendorKind, number>> = {};
      for (const [k, v] of a.byKind) byKind[k] = v;
      return {
        month: a.month,
        w9sCollected: a.w9sCollected,
        byKind,
        reportableCount: a.reportableCount,
      };
    })
    .sort((x, y) => x.month.localeCompare(y.month));

  return {
    rollup: {
      monthsConsidered: months.size,
      totalW9s,
      totalReportable,
      noCollectedDateSkipped,
    },
    rows,
  };
}
