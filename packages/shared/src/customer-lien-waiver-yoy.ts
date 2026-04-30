// Customer-anchored lien-waiver year-over-year.
//
// Plain English: for one customer (matched via ownerName or
// Job.ownerAgency), collapse two years of lien waivers into a
// comparison: counts, kind + status mix, payment + disputed
// cents (ex voided), distinct jobs, plus deltas.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { LienWaiver, LienWaiverKind, LienWaiverStatus } from './lien-waiver';

export interface CustomerLienWaiverYoyResult {
  customerName: string;
  priorYear: number;
  currentYear: number;
  priorTotal: number;
  priorByKind: Partial<Record<LienWaiverKind, number>>;
  priorByStatus: Partial<Record<LienWaiverStatus, number>>;
  priorPaymentAmountCents: number;
  priorDisputedAmountCents: number;
  priorDistinctJobs: number;
  currentTotal: number;
  currentByKind: Partial<Record<LienWaiverKind, number>>;
  currentByStatus: Partial<Record<LienWaiverStatus, number>>;
  currentPaymentAmountCents: number;
  currentDisputedAmountCents: number;
  currentDistinctJobs: number;
  totalDelta: number;
  paymentAmountDelta: number;
}

export interface CustomerLienWaiverYoyInputs {
  customerName: string;
  lienWaivers: LienWaiver[];
  jobs: Job[];
  currentYear: number;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildCustomerLienWaiverYoy(
  inputs: CustomerLienWaiverYoyInputs,
): CustomerLienWaiverYoyResult {
  const priorYear = inputs.currentYear - 1;
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Bucket = {
    total: number;
    byKind: Map<LienWaiverKind, number>;
    byStatus: Map<LienWaiverStatus, number>;
    paymentCents: number;
    disputedCents: number;
    jobs: Set<string>;
  };
  function emptyBucket(): Bucket {
    return { total: 0, byKind: new Map(), byStatus: new Map(), paymentCents: 0, disputedCents: 0, jobs: new Set() };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const w of inputs.lienWaivers) {
    const ownerMatch = norm(w.ownerName) === target;
    const jobMatch = customerJobs.has(w.jobId);
    if (!ownerMatch && !jobMatch) continue;
    const year = Number(w.throughDate.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.total += 1;
    b.byKind.set(w.kind, (b.byKind.get(w.kind) ?? 0) + 1);
    b.byStatus.set(w.status, (b.byStatus.get(w.status) ?? 0) + 1);
    if (w.status !== 'VOIDED') {
      b.paymentCents += w.paymentAmountCents ?? 0;
      b.disputedCents += w.disputedAmountCents ?? 0;
    }
    b.jobs.add(w.jobId);
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
    customerName: inputs.customerName,
    priorYear,
    currentYear: inputs.currentYear,
    priorTotal: prior.total,
    priorByKind: kindRecord(prior.byKind),
    priorByStatus: statusRecord(prior.byStatus),
    priorPaymentAmountCents: prior.paymentCents,
    priorDisputedAmountCents: prior.disputedCents,
    priorDistinctJobs: prior.jobs.size,
    currentTotal: current.total,
    currentByKind: kindRecord(current.byKind),
    currentByStatus: statusRecord(current.byStatus),
    currentPaymentAmountCents: current.paymentCents,
    currentDisputedAmountCents: current.disputedCents,
    currentDistinctJobs: current.jobs.size,
    totalDelta: current.total - prior.total,
    paymentAmountDelta: current.paymentCents - prior.paymentCents,
  };
}
