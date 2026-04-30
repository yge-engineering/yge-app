// Job-anchored lien-waiver snapshot.
//
// Plain English: for one job, as-of today, count waivers, sum
// payment amounts + disputed amounts (excluding voided), break
// down by kind + status, surface last-signed/delivered date.
// Drives the right-now per-job lien-release compliance overview
// against CA Civil Code §§8132/8134/8136/8138.
//
// Pure derivation. No persisted records.

import type { LienWaiver, LienWaiverKind, LienWaiverStatus } from './lien-waiver';

export interface JobLienWaiverSnapshotResult {
  asOf: string;
  jobId: string;
  totalWaivers: number;
  signedWaivers: number;
  deliveredWaivers: number;
  draftWaivers: number;
  voidedWaivers: number;
  totalPaymentAmountCents: number;
  totalDisputedAmountCents: number;
  byKind: Partial<Record<LienWaiverKind, number>>;
  byStatus: Partial<Record<LienWaiverStatus, number>>;
  lastSignedOrDeliveredDate: string | null;
}

export interface JobLienWaiverSnapshotInputs {
  jobId: string;
  lienWaivers: LienWaiver[];
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

export function buildJobLienWaiverSnapshot(
  inputs: JobLienWaiverSnapshotInputs,
): JobLienWaiverSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  const byKind = new Map<LienWaiverKind, number>();
  const byStatus = new Map<LienWaiverStatus, number>();

  let totalWaivers = 0;
  let signedWaivers = 0;
  let deliveredWaivers = 0;
  let draftWaivers = 0;
  let voidedWaivers = 0;
  let totalPaymentAmountCents = 0;
  let totalDisputedAmountCents = 0;
  let lastSignedOrDeliveredDate: string | null = null;

  for (const w of inputs.lienWaivers) {
    if (w.jobId !== inputs.jobId) continue;
    if (w.throughDate > asOf) continue;
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
    jobId: inputs.jobId,
    totalWaivers,
    signedWaivers,
    deliveredWaivers,
    draftWaivers,
    voidedWaivers,
    totalPaymentAmountCents,
    totalDisputedAmountCents,
    byKind: kOut,
    byStatus: sOut,
    lastSignedOrDeliveredDate,
  };
}
