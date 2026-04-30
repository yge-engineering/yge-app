// Job-anchored lien-waiver year-over-year.
//
// Plain English: for one job, collapse two years of lien
// waivers into a comparison: counts, kind + status mix,
// payment + disputed cents (ex voided), plus deltas.
//
// Pure derivation. No persisted records.

import type { LienWaiver, LienWaiverKind, LienWaiverStatus } from './lien-waiver';

export interface JobLienWaiverYoyResult {
  jobId: string;
  priorYear: number;
  currentYear: number;
  priorTotal: number;
  priorByKind: Partial<Record<LienWaiverKind, number>>;
  priorByStatus: Partial<Record<LienWaiverStatus, number>>;
  priorPaymentAmountCents: number;
  priorDisputedAmountCents: number;
  currentTotal: number;
  currentByKind: Partial<Record<LienWaiverKind, number>>;
  currentByStatus: Partial<Record<LienWaiverStatus, number>>;
  currentPaymentAmountCents: number;
  currentDisputedAmountCents: number;
  paymentDelta: number;
}

export interface JobLienWaiverYoyInputs {
  jobId: string;
  lienWaivers: LienWaiver[];
  currentYear: number;
}

export function buildJobLienWaiverYoy(inputs: JobLienWaiverYoyInputs): JobLienWaiverYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    total: number;
    byKind: Map<LienWaiverKind, number>;
    byStatus: Map<LienWaiverStatus, number>;
    payment: number;
    disputed: number;
  };
  function emptyBucket(): Bucket {
    return { total: 0, byKind: new Map(), byStatus: new Map(), payment: 0, disputed: 0 };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const w of inputs.lienWaivers) {
    if (w.jobId !== inputs.jobId) continue;
    const year = Number(w.throughDate.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.total += 1;
    b.byKind.set(w.kind, (b.byKind.get(w.kind) ?? 0) + 1);
    b.byStatus.set(w.status, (b.byStatus.get(w.status) ?? 0) + 1);
    if (w.status !== 'VOIDED') {
      b.payment += w.paymentAmountCents ?? 0;
      b.disputed += w.disputedAmountCents ?? 0;
    }
  }

  function kindRecord(m: Map<LienWaiverKind, number>): Partial<Record<LienWaiverKind, number>> {
    const out: Partial<Record<LienWaiverKind, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }
  function statusRecord(m: Map<LienWaiverStatus, number>): Partial<Record<LienWaiverStatus, number>> {
    const out: Partial<Record<LienWaiverStatus, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    jobId: inputs.jobId,
    priorYear,
    currentYear: inputs.currentYear,
    priorTotal: prior.total,
    priorByKind: kindRecord(prior.byKind),
    priorByStatus: statusRecord(prior.byStatus),
    priorPaymentAmountCents: prior.payment,
    priorDisputedAmountCents: prior.disputed,
    currentTotal: current.total,
    currentByKind: kindRecord(current.byKind),
    currentByStatus: statusRecord(current.byStatus),
    currentPaymentAmountCents: current.payment,
    currentDisputedAmountCents: current.disputed,
    paymentDelta: current.payment - prior.payment,
  };
}
