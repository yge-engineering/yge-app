// Portfolio subcontractor COI snapshot (point-in-time).
//
// Plain English: as-of today, count subcontractor vendors —
// total subs, current COIs, expiring within 30 days, expired,
// no COI on file. Drives the right-now COI watch overview.
//
// Pure derivation. No persisted records.

import type { Vendor } from './vendor';

export interface PortfolioCoiSnapshotResult {
  totalSubs: number;
  currentCount: number;
  expiringSoonCount: number;
  expiredCount: number;
  noCoiCount: number;
  onHoldCount: number;
}

export interface PortfolioCoiSnapshotInputs {
  vendors: Vendor[];
  /** Reference 'now'. Defaults to today. */
  asOf?: Date;
  /** Days-to-expiry threshold for "soon". Defaults to 30. */
  soonDays?: number;
}

const MS_PER_DAY = 86_400_000;

export function buildPortfolioCoiSnapshot(
  inputs: PortfolioCoiSnapshotInputs,
): PortfolioCoiSnapshotResult {
  const asOf = inputs.asOf ?? new Date();
  const soonDays = inputs.soonDays ?? 30;
  const soonCutoff = new Date(asOf.getTime() + soonDays * MS_PER_DAY);

  let totalSubs = 0;
  let currentCount = 0;
  let expiringSoonCount = 0;
  let expiredCount = 0;
  let noCoiCount = 0;
  let onHoldCount = 0;

  for (const v of inputs.vendors) {
    if (v.kind !== 'SUBCONTRACTOR') continue;
    totalSubs += 1;
    if (v.onHold === true) onHoldCount += 1;
    if (!v.coiOnFile || !v.coiExpiresOn) {
      noCoiCount += 1;
      continue;
    }
    const exp = new Date(`${v.coiExpiresOn}T23:59:59Z`);
    if (exp.getTime() < asOf.getTime()) expiredCount += 1;
    else if (exp.getTime() <= soonCutoff.getTime()) expiringSoonCount += 1;
    else currentCount += 1;
  }

  return {
    totalSubs,
    currentCount,
    expiringSoonCount,
    expiredCount,
    noCoiCount,
    onHoldCount,
  };
}
