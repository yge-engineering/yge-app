// Customer-anchored lien-waiver snapshot.
//
// Plain English: for one customer (matched by ownerName on
// the waiver itself, with fallback to Job.ownerAgency), as-of
// today, count waivers, kind + status mix, payment + disputed
// cents (ex voided), distinct jobs, last signed/delivered date.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { LienWaiver, LienWaiverKind, LienWaiverStatus } from './lien-waiver';

export interface CustomerLienWaiverSnapshotResult {
  asOf: string;
  customerName: string;
  totalWaivers: number;
  signedWaivers: number;
  deliveredWaivers: number;
  draftWaivers: number;
  voidedWaivers: number;
  totalPaymentAmountCents: number;
  totalDisputedAmountCents: number;
  byKind: Partial<Record<LienWaiverKind, number>>;
  byStatus: Partial<Record<LienWaiverStatus, number>>;
  distinctJobs: number;
  lastSignedOrDeliveredDate: string | null;
}

export interface CustomerLienWaiverSnapshotInputs {
  customerName: string;
  lienWaivers: LienWaiver[];
  jobs: Job[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildCustomerLienWaiverSnapshot(
  inputs: CustomerLienWaiverSnapshotInputs,
): CustomerLienWaiverSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  const byKind = new Map<LienWaiverKind, number>();
  const byStatus = new Map<LienWaiverStatus, number>();
  const jobs = new Set<string>();

  let totalWaivers = 0;
  let signedWaivers = 0;
  let deliveredWaivers = 0;
  let draftWaivers = 0;
  let voidedWaivers = 0;
  let totalPaymentAmountCents = 0;
  let totalDisputedAmountCents = 0;
  let lastSignedOrDeliveredDate: string | null = null;

  for (const w of inputs.lienWaivers) {
    if (w.throughDate > asOf) continue;
    const ownerMatch = norm(w.ownerName) === target;
    const jobMatch = customerJobs.has(w.jobId);
    if (!ownerMatch && !jobMatch) continue;

    totalWaivers += 1;
    byKind.set(w.kind, (byKind.get(w.kind) ?? 0) + 1);
    byStatus.set(w.status, (byStatus.get(w.status) ?? 0) + 1);
    if (w.status === 'SIGNED') signedWaivers += 1;
    else if (w.status === 'DELIVERED') deliveredWaivers += 1;
    else if (w.status === 'DRAFT') draftWaivers += 1;
    else if (w.status === 'VOIDED') voidedWaivers += 1;
    if (w.status !== 'VOIDED') {
      totalPaymentAmountCents += w.paymentAmountCents ?? 0;
      totalDisputedAmountCents += w.disputedAmountCents ?? 0;
    }
    jobs.add(w.jobId);
    const dt = w.deliveredOn ?? w.signedOn;
    if (dt && /^\d{4}-\d{2}-\d{2}$/.test(dt)) {
      if (lastSignedOrDeliveredDate == null || dt > lastSignedOrDeliveredDate) {
        lastSignedOrDeliveredDate = dt;
      }
    }
  }

  const kOut: Partial<Record<LienWaiverKind, number>> = {};
  for (const [k, v] of byKind) kOut[k] = v;
  const sOut: Partial<Record<LienWaiverStatus, number>> = {};
  for (const [k, v] of byStatus) sOut[k] = v;

  return {
    asOf,
    customerName: inputs.customerName,
    totalWaivers,
    signedWaivers,
    deliveredWaivers,
    draftWaivers,
    voidedWaivers,
    totalPaymentAmountCents,
    totalDisputedAmountCents,
    byKind: kOut,
    byStatus: sOut,
    distinctJobs: jobs.size,
    lastSignedOrDeliveredDate,
  };
}
