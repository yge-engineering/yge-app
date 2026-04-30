// Portfolio vendor pre-qualification YoY (year-end snapshot).
//
// Plain English: take a year-end snapshot of vendor master
// records that existed at year-end, count tier mix (READY,
// missing W-9, missing COI on subs, on-hold). YoY tracks
// whether vendor compliance is improving year over year.
//
// "Tier" matching is computed as-of the snapshot date.
//
// Different from vendor-prequal-summary (point-in-time, no
// time axis), portfolio-vendor-yoy (AP spend, not prequal).
//
// Pure derivation. No persisted records.

import type { Vendor, VendorKind } from './vendor';
import { vendorCoiCurrent, vendorW9Current } from './vendor';

export interface PortfolioVendorPrequalYoyBucket {
  totalVendors: number;
  readyCount: number;
  missingW9Count: number;
  missingCoiSubsCount: number;
  onHoldCount: number;
  byKind: Partial<Record<VendorKind, number>>;
}

export interface PortfolioVendorPrequalYoyResult {
  priorYear: number;
  currentYear: number;
  prior: PortfolioVendorPrequalYoyBucket;
  current: PortfolioVendorPrequalYoyBucket;
  totalVendorsDelta: number;
  readyCountDelta: number;
}

export interface PortfolioVendorPrequalYoyInputs {
  vendors: Vendor[];
  currentYear: number;
}

function snapshot(vendors: Vendor[], asOfYear: number): PortfolioVendorPrequalYoyBucket {
  const asOfStamp = `${asOfYear}-12-31T23:59:59.999Z`;
  const asOfDate = new Date(`${asOfYear}-12-31T23:59:59Z`);

  let totalVendors = 0;
  let readyCount = 0;
  let missingW9Count = 0;
  let missingCoiSubsCount = 0;
  let onHoldCount = 0;
  const byKind = new Map<VendorKind, number>();

  for (const v of vendors) {
    if (v.createdAt > asOfStamp) continue;
    totalVendors += 1;
    byKind.set(v.kind, (byKind.get(v.kind) ?? 0) + 1);

    const w9OK = vendorW9Current(v, asOfDate);
    const coiOK = v.kind === 'SUBCONTRACTOR' ? vendorCoiCurrent(v, asOfDate) : true;
    const onHold = v.onHold === true;

    if (!w9OK) missingW9Count += 1;
    if (v.kind === 'SUBCONTRACTOR' && !coiOK) missingCoiSubsCount += 1;
    if (onHold) onHoldCount += 1;
    if (w9OK && coiOK && !onHold) readyCount += 1;
  }

  const out: Partial<Record<VendorKind, number>> = {};
  for (const [k, val] of byKind) out[k] = val;
  return {
    totalVendors,
    readyCount,
    missingW9Count,
    missingCoiSubsCount,
    onHoldCount,
    byKind: out,
  };
}

export function buildPortfolioVendorPrequalYoy(
  inputs: PortfolioVendorPrequalYoyInputs,
): PortfolioVendorPrequalYoyResult {
  const priorYear = inputs.currentYear - 1;
  const prior = snapshot(inputs.vendors, priorYear);
  const current = snapshot(inputs.vendors, inputs.currentYear);
  return {
    priorYear,
    currentYear: inputs.currentYear,
    prior,
    current,
    totalVendorsDelta: current.totalVendors - prior.totalVendors,
    readyCountDelta: current.readyCount - prior.readyCount,
  };
}
