// Per-customer lien waiver delivery cadence.
//
// Plain English: every progress + final payment YGE receives needs
// the matching CA Civil Code §8132/§8134/§8136/§8138 waiver
// delivered to the customer. Each waiver carries a signedOn date
// and a deliveredOn date — the gap between the two is how long
// it sits in the office before going out.
//
// This module groups waivers by ownerName (canonicalized) and
// surfaces:
//   - count of waivers per customer
//   - average + median days signed-to-delivered
//   - count of SIGNED waivers still sitting (no deliveredOn)
//   - oldest undelivered waiver age in days (vs an asOf date)
//
// Different from lien-waiver-chase (which is per-payment + asks
// "what waiver does this payment need?"). This is per-customer
// and asks "how fast do we get our waivers out the door?"
//
// Pure derivation. No persisted records.

import type { LienWaiver } from './lien-waiver';

export interface CustomerWaiverCadenceRow {
  customerName: string;
  totalWaivers: number;
  /** Waivers with both signedOn and deliveredOn populated. */
  delivered: number;
  /** SIGNED status with no deliveredOn — the office bottleneck. */
  signedNotDelivered: number;
  /** DRAFT status — not yet signed by Brook. */
  draftCount: number;
  /** Average days signedOn → deliveredOn across `delivered` rows.
   *  Null if `delivered` is 0. */
  avgDaysToDeliver: number | null;
  /** Median days signedOn → deliveredOn. Null if `delivered` is 0. */
  medianDaysToDeliver: number | null;
  /** Oldest undelivered (signedNotDelivered) waiver age in days
   *  from signedOn to asOf. Null if no undelivered waivers. */
  oldestUndeliveredAgeDays: number | null;
  /** Total dollars across `delivered` waivers. */
  deliveredAmountCents: number;
}

export interface CustomerWaiverCadenceRollup {
  customersConsidered: number;
  waiversConsidered: number;
  totalSignedNotDelivered: number;
  totalDraft: number;
  /** Blended avg days-to-deliver across the portfolio. Null if no
   *  delivered waivers. */
  blendedAvgDaysToDeliver: number | null;
}

export interface CustomerWaiverCadenceInputs {
  waivers: LienWaiver[];
  /** asOf yyyy-mm-dd for "oldest undelivered" age. Defaults to the
   *  most recent signedOn observed; falls back to throughDate. */
  asOf?: string;
}

export function buildCustomerWaiverCadence(
  inputs: CustomerWaiverCadenceInputs,
): {
  rollup: CustomerWaiverCadenceRollup;
  rows: CustomerWaiverCadenceRow[];
} {
  // Determine asOf — caller-provided wins; otherwise pick the latest
  // signedOn / throughDate seen.
  let asOf = inputs.asOf;
  if (!asOf) {
    let latest = '';
    for (const w of inputs.waivers) {
      const candidate = w.signedOn ?? w.throughDate;
      if (candidate > latest) latest = candidate;
    }
    asOf = latest || '1970-01-01';
  }

  // Bucket by canonicalized customer name.
  const buckets = new Map<string, LienWaiver[]>();
  const displayNames = new Map<string, string>();
  for (const w of inputs.waivers) {
    if (w.status === 'VOIDED') continue;
    const key = canonicalize(w.ownerName);
    const list = buckets.get(key) ?? [];
    list.push(w);
    buckets.set(key, list);
    if (!displayNames.has(key)) displayNames.set(key, w.ownerName);
  }

  const rows: CustomerWaiverCadenceRow[] = [];
  let totalUndelivered = 0;
  let totalDraft = 0;
  let blendedDeliveredCount = 0;
  let blendedDeliveredDaysSum = 0;

  for (const [key, ws] of buckets.entries()) {
    let delivered = 0;
    let signedNotDelivered = 0;
    let draft = 0;
    const days: number[] = [];
    let deliveredCents = 0;
    let oldestUndelivered: number | null = null;

    for (const w of ws) {
      if (w.status === 'DRAFT') draft += 1;
      if (w.signedOn && w.deliveredOn) {
        delivered += 1;
        const d = daysBetween(w.signedOn, w.deliveredOn);
        days.push(d);
        deliveredCents += w.paymentAmountCents;
      } else if (w.status === 'SIGNED' && w.signedOn && !w.deliveredOn) {
        signedNotDelivered += 1;
        const age = daysBetween(w.signedOn, asOf);
        if (age >= 0 && (oldestUndelivered === null || age > oldestUndelivered)) {
          oldestUndelivered = age;
        }
      }
    }

    const avg = days.length === 0
      ? null
      : Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10;
    const median = computeMedian(days);

    blendedDeliveredCount += delivered;
    blendedDeliveredDaysSum += days.reduce((a, b) => a + b, 0);

    rows.push({
      customerName: displayNames.get(key) ?? key,
      totalWaivers: ws.length,
      delivered,
      signedNotDelivered,
      draftCount: draft,
      avgDaysToDeliver: avg,
      medianDaysToDeliver: median,
      oldestUndeliveredAgeDays: oldestUndelivered,
      deliveredAmountCents: deliveredCents,
    });

    totalUndelivered += signedNotDelivered;
    totalDraft += draft;
  }

  // Sort: customers with the most signed-not-delivered first
  // (most actionable), then by oldest undelivered age, then by total
  // waivers desc.
  rows.sort((a, b) => {
    if (a.signedNotDelivered !== b.signedNotDelivered) {
      return b.signedNotDelivered - a.signedNotDelivered;
    }
    if (a.oldestUndeliveredAgeDays !== b.oldestUndeliveredAgeDays) {
      return (b.oldestUndeliveredAgeDays ?? -1) - (a.oldestUndeliveredAgeDays ?? -1);
    }
    return b.totalWaivers - a.totalWaivers;
  });

  return {
    rollup: {
      customersConsidered: rows.length,
      waiversConsidered: rows.reduce((acc, r) => acc + r.totalWaivers, 0),
      totalSignedNotDelivered: totalUndelivered,
      totalDraft,
      blendedAvgDaysToDeliver: blendedDeliveredCount === 0
        ? null
        : Math.round((blendedDeliveredDaysSum / blendedDeliveredCount) * 10) / 10,
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

function daysBetween(fromIso: string, toIso: string): number {
  const fromParts = fromIso.split('-').map((p) => Number.parseInt(p, 10));
  const toParts = toIso.split('-').map((p) => Number.parseInt(p, 10));
  const a = Date.UTC(fromParts[0] ?? 0, (fromParts[1] ?? 1) - 1, fromParts[2] ?? 1);
  const b = Date.UTC(toParts[0] ?? 0, (toParts[1] ?? 1) - 1, toParts[2] ?? 1);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid] ?? null;
  }
  const a = sorted[mid - 1] ?? 0;
  const b = sorted[mid] ?? 0;
  return Math.round(((a + b) / 2) * 10) / 10;
}
