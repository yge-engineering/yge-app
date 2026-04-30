// Portfolio W-9 freshness snapshot (point-in-time).
//
// Plain English: as-of today, walk every 1099-reportable
// vendor and classify their W-9 — current (within IRS 3-year
// window), stale, missing W-9, missing collected date.
//
// Pure derivation. No persisted records.

import type { Vendor } from './vendor';
import { vendorW9Current } from './vendor';

export interface PortfolioW9SnapshotResult {
  totalReportable: number;
  currentCount: number;
  staleCount: number;
  missingW9Count: number;
  missingDateCount: number;
}

export interface PortfolioW9SnapshotInputs {
  vendors: Vendor[];
  /** Reference 'now'. Defaults to today. */
  asOf?: Date;
}

export function buildPortfolioW9Snapshot(
  inputs: PortfolioW9SnapshotInputs,
): PortfolioW9SnapshotResult {
  const asOf = inputs.asOf ?? new Date();

  let totalReportable = 0;
  let currentCount = 0;
  let staleCount = 0;
  let missingW9Count = 0;
  let missingDateCount = 0;

  for (const v of inputs.vendors) {
    if (!v.is1099Reportable) continue;
    totalReportable += 1;
    if (!v.w9OnFile) {
      missingW9Count += 1;
      continue;
    }
    if (!v.w9CollectedOn) {
      missingDateCount += 1;
      continue;
    }
    if (vendorW9Current(v, asOf)) currentCount += 1;
    else staleCount += 1;
  }

  return {
    totalReportable,
    currentCount,
    staleCount,
    missingW9Count,
    missingDateCount,
  };
}
