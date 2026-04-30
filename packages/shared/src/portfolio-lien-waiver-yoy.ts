// Portfolio lien waiver year-over-year.
//
// Plain English: collapse two years of lien waivers into a
// single comparison row with kind mix + status (signed,
// delivered, voided) + total amount cents + distinct jobs +
// deltas.
//
// Different from portfolio-lien-waiver-monthly (per month).
//
// Pure derivation. No persisted records.

import type { LienWaiver, LienWaiverKind } from './lien-waiver';

export interface PortfolioLienWaiverYoyResult {
  priorYear: number;
  currentYear: number;
  priorTotal: number;
  priorTotalAmountCents: number;
  priorByKind: Partial<Record<LienWaiverKind, number>>;
  priorSignedCount: number;
  priorDeliveredCount: number;
  priorVoidedCount: number;
  priorDistinctJobs: number;
  currentTotal: number;
  currentTotalAmountCents: number;
  currentByKind: Partial<Record<LienWaiverKind, number>>;
  currentSignedCount: number;
  currentDeliveredCount: number;
  currentVoidedCount: number;
  currentDistinctJobs: number;
  totalDelta: number;
  totalAmountCentsDelta: number;
}

export interface PortfolioLienWaiverYoyInputs {
  lienWaivers: LienWaiver[];
  currentYear: number;
}

export function buildPortfolioLienWaiverYoy(
  inputs: PortfolioLienWaiverYoyInputs,
): PortfolioLienWaiverYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    total: number;
    totalAmountCents: number;
    byKind: Map<LienWaiverKind, number>;
    signedCount: number;
    deliveredCount: number;
    voidedCount: number;
    jobs: Set<string>;
  };
  function emptyBucket(): Bucket {
    return {
      total: 0,
      totalAmountCents: 0,
      byKind: new Map(),
      signedCount: 0,
      deliveredCount: 0,
      voidedCount: 0,
      jobs: new Set(),
    };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const w of inputs.lienWaivers) {
    const year = Number(w.throughDate.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.total += 1;
    b.totalAmountCents += w.paymentAmountCents;
    b.byKind.set(w.kind, (b.byKind.get(w.kind) ?? 0) + 1);
    const status = w.status ?? 'DRAFT';
    if (status === 'SIGNED' || status === 'DELIVERED') b.signedCount += 1;
    if (status === 'DELIVERED') b.deliveredCount += 1;
    if (status === 'VOIDED') b.voidedCount += 1;
    b.jobs.add(w.jobId);
  }

  function toRecord(m: Map<LienWaiverKind, number>): Partial<Record<LienWaiverKind, number>> {
    const out: Partial<Record<LienWaiverKind, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    priorYear,
    currentYear: inputs.currentYear,
    priorTotal: prior.total,
    priorTotalAmountCents: prior.totalAmountCents,
    priorByKind: toRecord(prior.byKind),
    priorSignedCount: prior.signedCount,
    priorDeliveredCount: prior.deliveredCount,
    priorVoidedCount: prior.voidedCount,
    priorDistinctJobs: prior.jobs.size,
    currentTotal: current.total,
    currentTotalAmountCents: current.totalAmountCents,
    currentByKind: toRecord(current.byKind),
    currentSignedCount: current.signedCount,
    currentDeliveredCount: current.deliveredCount,
    currentVoidedCount: current.voidedCount,
    currentDistinctJobs: current.jobs.size,
    totalDelta: current.total - prior.total,
    totalAmountCentsDelta: current.totalAmountCents - prior.totalAmountCents,
  };
}
