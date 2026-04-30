// Customer-anchored per-job lien waiver detail snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// return one row per job: lien waiver total, status counts,
// conditional vs unconditional, progress vs final, total payment
// cents waived (delivered + signed only), last waiver date.
// Sorted by total payment waived desc.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { LienWaiver } from './lien-waiver';

export interface CustomerLienWaiverDetailRow {
  jobId: string;
  total: number;
  draft: number;
  signed: number;
  delivered: number;
  voided: number;
  conditional: number;
  unconditional: number;
  progress: number;
  final: number;
  totalWaivedCents: number;
  lastWaiverDate: string | null;
}

export interface CustomerLienWaiverDetailSnapshotResult {
  asOf: string;
  customerName: string;
  rows: CustomerLienWaiverDetailRow[];
}

export interface CustomerLienWaiverDetailSnapshotInputs {
  customerName: string;
  jobs: Job[];
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

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildCustomerLienWaiverDetailSnapshot(
  inputs: CustomerLienWaiverDetailSnapshotInputs,
): CustomerLienWaiverDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Acc = {
    total: number;
    draft: number;
    signed: number;
    delivered: number;
    voided: number;
    conditional: number;
    unconditional: number;
    progress: number;
    final: number;
    waivedCents: number;
    lastDate: string | null;
  };
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
    if (!a) {
      a = {
        total: 0,
        draft: 0,
        signed: 0,
        delivered: 0,
        voided: 0,
        conditional: 0,
        unconditional: 0,
        progress: 0,
        final: 0,
        waivedCents: 0,
        lastDate: null,
      };
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const w of inputs.lienWaivers) {
    if (!customerJobs.has(w.jobId)) continue;
    if (w.throughDate > asOf) continue;
    const a = getAcc(w.jobId);
    a.total += 1;
    if (w.status === 'DRAFT') a.draft += 1;
    else if (w.status === 'SIGNED') a.signed += 1;
    else if (w.status === 'DELIVERED') a.delivered += 1;
    else if (w.status === 'VOIDED') a.voided += 1;
    if (w.kind === 'CONDITIONAL_PROGRESS' || w.kind === 'CONDITIONAL_FINAL') a.conditional += 1;
    else a.unconditional += 1;
    if (w.kind === 'CONDITIONAL_PROGRESS' || w.kind === 'UNCONDITIONAL_PROGRESS') a.progress += 1;
    else a.final += 1;
    if (w.status === 'SIGNED' || w.status === 'DELIVERED') a.waivedCents += w.paymentAmountCents;
    if (a.lastDate == null || w.throughDate > a.lastDate) a.lastDate = w.throughDate;
  }

  const rows: CustomerLienWaiverDetailRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
      total: a.total,
      draft: a.draft,
      signed: a.signed,
      delivered: a.delivered,
      voided: a.voided,
      conditional: a.conditional,
      unconditional: a.unconditional,
      progress: a.progress,
      final: a.final,
      totalWaivedCents: a.waivedCents,
      lastWaiverDate: a.lastDate,
    }))
    .sort((a, b) => b.totalWaivedCents - a.totalWaivedCents || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    customerName: inputs.customerName,
    rows,
  };
}
