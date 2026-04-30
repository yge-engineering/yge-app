// Portfolio vendor master snapshot.
//
// Plain English: point-in-time count of every vendor in the
// system, broken down by VendorKind, state, on-hold, 1099-
// reportable, and W-9 / COI status. Drives the office's
// right-now compliance overview.
//
// Pure derivation. No persisted records.

import type { Vendor, VendorKind } from './vendor';
import { vendorCoiCurrent, vendorW9Current } from './vendor';

export interface PortfolioVendorSnapshotResult {
  totalVendors: number;
  byKind: Partial<Record<VendorKind, number>>;
  byState: Partial<Record<string, number>>;
  onHoldCount: number;
  reportable1099Count: number;
  w9CurrentCount: number;
  coiCurrentSubsCount: number;
  subcontractorCount: number;
}

export interface PortfolioVendorSnapshotInputs {
  vendors: Vendor[];
  /** Reference 'now'. Defaults to today. */
  asOf?: Date;
}

export function buildPortfolioVendorSnapshot(
  inputs: PortfolioVendorSnapshotInputs,
): PortfolioVendorSnapshotResult {
  const asOf = inputs.asOf ?? new Date();
  const byKind = new Map<VendorKind, number>();
  const byState = new Map<string, number>();
  let onHoldCount = 0;
  let reportable1099Count = 0;
  let w9CurrentCount = 0;
  let coiCurrentSubsCount = 0;
  let subcontractorCount = 0;

  for (const v of inputs.vendors) {
    byKind.set(v.kind, (byKind.get(v.kind) ?? 0) + 1);
    if (v.state) byState.set(v.state, (byState.get(v.state) ?? 0) + 1);
    if (v.onHold === true) onHoldCount += 1;
    if (v.is1099Reportable) reportable1099Count += 1;
    if (vendorW9Current(v, asOf)) w9CurrentCount += 1;
    if (v.kind === 'SUBCONTRACTOR') {
      subcontractorCount += 1;
      if (vendorCoiCurrent(v, asOf)) coiCurrentSubsCount += 1;
    }
  }

  const kindOut: Partial<Record<VendorKind, number>> = {};
  for (const [k, val] of byKind) kindOut[k] = val;
  const stateOut: Partial<Record<string, number>> = {};
  for (const [k, val] of byState) stateOut[k] = val;

  return {
    totalVendors: inputs.vendors.length,
    byKind: kindOut,
    byState: stateOut,
    onHoldCount,
    reportable1099Count,
    w9CurrentCount,
    coiCurrentSubsCount,
    subcontractorCount,
  };
}
