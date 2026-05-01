// Job-anchored per-kind lien waiver detail snapshot.
//
// Plain English: for one job, return one row per CA Civil Code
// statutory waiver kind (§8132/§8134/§8136/§8138): total, by
// status (draft/signed/delivered/voided), total payment cents
// waived, last waiver date. Sorted by total waived desc.
//
// Pure derivation. No persisted records.

import type { LienWaiver } from './lien-waiver';

export interface JobLienWaiverDetailRow {
  kind: string;
  total: number;
  draft: number;
  signed: number;
  delivered: number;
  voided: number;
  totalWaivedCents: number;
  lastWaiverDate: string | null;
}

export interface JobLienWaiverDetailSnapshotResult {
  asOf: string;
  jobId: string;
  rows: JobLienWaiverDetailRow[];
}

export interface JobLienWaiverDetailSnapshotInputs {
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

export function buildJobLienWaiverDetailSnapshot(
  inputs: JobLienWaiverDetailSnapshotInputs,
): JobLienWaiverDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  type Acc = {
    total: number;
    draft: number;
    signed: number;
    delivered: number;
    voided: number;
    waivedCents: number;
    lastDate: string | null;
  };
  const byKind = new Map<string, Acc>();
  function getAcc(kind: string): Acc {
    let a = byKind.get(kind);
    if (!a) {
      a = { total: 0, draft: 0, signed: 0, delivered: 0, voided: 0, waivedCents: 0, lastDate: null };
      byKind.set(kind, a);
    }
    return a;
  }

  for (const w of inputs.lienWaivers) {
    if (w.jobId !== inputs.jobId) continue;
    if (w.throughDate > asOf) continue;
    const a = getAcc(w.kind);
    a.total += 1;
    if (w.status === 'DRAFT') a.draft += 1;
    else if (w.status === 'SIGNED') a.signed += 1;
    else if (w.status === 'DELIVERED') a.delivered += 1;
    else if (w.status === 'VOIDED') a.voided += 1;
    if (w.status === 'SIGNED' || w.status === 'DELIVERED') a.waivedCents += w.paymentAmountCents;
    if (a.lastDate == null || w.throughDate > a.lastDate) a.lastDate = w.throughDate;
  }

  const rows: JobLienWaiverDetailRow[] = [...byKind.entries()]
    .map(([kind, a]) => ({
      kind,
      total: a.total,
      draft: a.draft,
      signed: a.signed,
      delivered: a.delivered,
      voided: a.voided,
      totalWaivedCents: a.waivedCents,
      lastWaiverDate: a.lastDate,
    }))
    .sort((a, b) => b.totalWaivedCents - a.totalWaivedCents || a.kind.localeCompare(b.kind));

  return {
    asOf,
    jobId: inputs.jobId,
    rows,
  };
}
