// Portfolio W-9 freshness year-over-year.
//
// Plain English: collapse two years of W-9 collection deadlines
// (collectedOn + 3 years per IRS) into a comparison row.
// Sized for the bookkeeper's year-end "how much chase work is
// in front of us" planning.
//
// Different from portfolio-w9-monthly-expiring (per month).
//
// Pure derivation. No persisted records.

import type { Vendor, VendorKind } from './vendor';

export interface PortfolioW9YoyResult {
  priorYear: number;
  currentYear: number;
  priorTotal: number;
  priorByKind: Partial<Record<VendorKind, number>>;
  currentTotal: number;
  currentByKind: Partial<Record<VendorKind, number>>;
  totalDelta: number;
}

export interface PortfolioW9YoyInputs {
  vendors: Vendor[];
  currentYear: number;
}

const REFRESH_YEARS = 3;

function addYears(yyyymmdd: string, years: number): string {
  const [yStr, mStr, dStr] = yyyymmdd.split('-');
  const y = Number(yStr ?? '0') + years;
  const m = Number(mStr ?? '0');
  const d = Number(dStr ?? '0');
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function buildPortfolioW9Yoy(
  inputs: PortfolioW9YoyInputs,
): PortfolioW9YoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = { total: number; byKind: Map<VendorKind, number> };
  function emptyBucket(): Bucket {
    return { total: 0, byKind: new Map() };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const v of inputs.vendors) {
    if (!v.is1099Reportable) continue;
    if (!v.w9OnFile) continue;
    if (!v.w9CollectedOn || !/^\d{4}-\d{2}-\d{2}$/.test(v.w9CollectedOn)) continue;
    const refreshDate = addYears(v.w9CollectedOn, REFRESH_YEARS);
    const refreshYear = Number(refreshDate.slice(0, 4));
    let b: Bucket | null = null;
    if (refreshYear === priorYear) b = prior;
    else if (refreshYear === inputs.currentYear) b = current;
    if (!b) continue;
    b.total += 1;
    b.byKind.set(v.kind, (b.byKind.get(v.kind) ?? 0) + 1);
  }

  function toRecord(m: Map<VendorKind, number>): Partial<Record<VendorKind, number>> {
    const out: Partial<Record<VendorKind, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    priorYear,
    currentYear: inputs.currentYear,
    priorTotal: prior.total,
    priorByKind: toRecord(prior.byKind),
    currentTotal: current.total,
    currentByKind: toRecord(current.byKind),
    totalDelta: current.total - prior.total,
  };
}
