// Per-job AR receipt rollup.
//
// Plain English: bucket AR payments by jobId and roll up the
// kind mix (PROGRESS / RETENTION_RELEASE / FINAL / PARTIAL /
// OTHER) plus total cents and last receipt date.
//
// Per row: jobId, total, totalCents, byKind, lastReceivedOn.
//
// Sort by totalCents desc.
//
// Different from ar-payment-monthly (per-month, no job axis),
// ar-payment-by-kind-monthly (per (month, kind)).
//
// Pure derivation. No persisted records.

import type { ArPayment, ArPaymentKind } from './ar-payment';

export interface ArPaymentByJobRow {
  jobId: string;
  total: number;
  totalCents: number;
  byKind: Partial<Record<ArPaymentKind, number>>;
  lastReceivedOn: string | null;
}

export interface ArPaymentByJobRollup {
  jobsConsidered: number;
  totalPayments: number;
  totalCents: number;
  unattributed: number;
}

export interface ArPaymentByJobInputs {
  arPayments: ArPayment[];
  /** Optional yyyy-mm-dd window applied to receivedOn. */
  fromDate?: string;
  toDate?: string;
}

export function buildArPaymentByJob(
  inputs: ArPaymentByJobInputs,
): {
  rollup: ArPaymentByJobRollup;
  rows: ArPaymentByJobRow[];
} {
  type Acc = {
    jobId: string;
    total: number;
    cents: number;
    byKind: Map<ArPaymentKind, number>;
    lastReceived: string | null;
  };
  const accs = new Map<string, Acc>();
  let portfolioTotal = 0;
  let portfolioCents = 0;
  let unattributed = 0;

  for (const p of inputs.arPayments) {
    if (inputs.fromDate && p.receivedOn < inputs.fromDate) continue;
    if (inputs.toDate && p.receivedOn > inputs.toDate) continue;
    portfolioTotal += 1;
    portfolioCents += p.amountCents;
    const jobId = (p.jobId ?? '').trim();
    if (!jobId) {
      unattributed += 1;
      continue;
    }
    const acc = accs.get(jobId) ?? {
      jobId,
      total: 0,
      cents: 0,
      byKind: new Map<ArPaymentKind, number>(),
      lastReceived: null,
    };
    acc.total += 1;
    acc.cents += p.amountCents;
    acc.byKind.set(p.kind, (acc.byKind.get(p.kind) ?? 0) + 1);
    if (!acc.lastReceived || p.receivedOn > acc.lastReceived) acc.lastReceived = p.receivedOn;
    accs.set(jobId, acc);
  }

  const rows: ArPaymentByJobRow[] = [];
  for (const acc of accs.values()) {
    const obj: Partial<Record<ArPaymentKind, number>> = {};
    for (const [k, v] of acc.byKind.entries()) obj[k] = v;
    rows.push({
      jobId: acc.jobId,
      total: acc.total,
      totalCents: acc.cents,
      byKind: obj,
      lastReceivedOn: acc.lastReceived,
    });
  }

  rows.sort((a, b) => b.totalCents - a.totalCents);

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalPayments: portfolioTotal,
      totalCents: portfolioCents,
      unattributed,
    },
    rows,
  };
}
