// Customer-anchored per-job AR payment detail snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency or
// payerName), return one row per job they paid us on: payment count,
// total cents received, retention-release count + cents (PCC §7107),
// final payment count + cents, payment-method mix counts, last
// payment date. Sorted by total received desc.
//
// Pure derivation. No persisted records.

import type { ArPayment } from './ar-payment';
import type { Job } from './job';

export interface CustomerPaymentDetailRow {
  jobId: string;
  paymentCount: number;
  totalCents: number;
  progressCents: number;
  retentionReleaseCount: number;
  retentionReleaseCents: number;
  finalCount: number;
  finalCents: number;
  achCount: number;
  checkCount: number;
  wireCount: number;
  cardCount: number;
  cashCount: number;
  lastPaymentDate: string | null;
}

export interface CustomerPaymentDetailSnapshotResult {
  asOf: string;
  customerName: string;
  rows: CustomerPaymentDetailRow[];
}

export interface CustomerPaymentDetailSnapshotInputs {
  customerName: string;
  jobs: Job[];
  arPayments: ArPayment[];
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

export function buildCustomerPaymentDetailSnapshot(
  inputs: CustomerPaymentDetailSnapshotInputs,
): CustomerPaymentDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Acc = {
    count: number;
    total: number;
    progress: number;
    retentionCount: number;
    retentionCents: number;
    finalCount: number;
    finalCents: number;
    ach: number;
    check: number;
    wire: number;
    card: number;
    cash: number;
    lastDate: string | null;
  };
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
    if (!a) {
      a = {
        count: 0,
        total: 0,
        progress: 0,
        retentionCount: 0,
        retentionCents: 0,
        finalCount: 0,
        finalCents: 0,
        ach: 0,
        check: 0,
        wire: 0,
        card: 0,
        cash: 0,
        lastDate: null,
      };
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const p of inputs.arPayments) {
    const jobMatch = customerJobs.has(p.jobId);
    const nameMatch = norm(p.payerName) === target;
    if (!jobMatch && !nameMatch) continue;
    if (p.receivedOn > asOf) continue;
    const a = getAcc(p.jobId);
    a.count += 1;
    a.total += p.amountCents;
    if (p.kind === 'PROGRESS' || p.kind === 'PARTIAL') a.progress += p.amountCents;
    if (p.kind === 'RETENTION_RELEASE') {
      a.retentionCount += 1;
      a.retentionCents += p.amountCents;
    }
    if (p.kind === 'FINAL') {
      a.finalCount += 1;
      a.finalCents += p.amountCents;
    }
    switch (p.method) {
      case 'ACH': a.ach += 1; break;
      case 'CHECK': a.check += 1; break;
      case 'WIRE': a.wire += 1; break;
      case 'CARD': a.card += 1; break;
      case 'CASH': a.cash += 1; break;
    }
    if (a.lastDate == null || p.receivedOn > a.lastDate) a.lastDate = p.receivedOn;
  }

  const rows: CustomerPaymentDetailRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
      paymentCount: a.count,
      totalCents: a.total,
      progressCents: a.progress,
      retentionReleaseCount: a.retentionCount,
      retentionReleaseCents: a.retentionCents,
      finalCount: a.finalCount,
      finalCents: a.finalCents,
      achCount: a.ach,
      checkCount: a.check,
      wireCount: a.wire,
      cardCount: a.card,
      cashCount: a.cash,
      lastPaymentDate: a.lastDate,
    }))
    .sort((a, b) => b.totalCents - a.totalCents || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    customerName: inputs.customerName,
    rows,
  };
}
