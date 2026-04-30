// Portfolio customer payment (AR cash receipts) snapshot.
//
// Plain English: as-of today, count AR payments, sum cents,
// break down by kind + method, count distinct payers + jobs,
// and surface YTD totals. Drives the right-now cash-collected
// overview.
//
// Pure derivation. No persisted records.

import type { ArPayment, ArPaymentKind, ArPaymentMethod } from './ar-payment';

export interface PortfolioCustomerPaymentSnapshotResult {
  asOf: string;
  ytdLogYear: number;
  totalPayments: number;
  ytdPayments: number;
  totalCents: number;
  ytdCents: number;
  byKind: Partial<Record<ArPaymentKind, number>>;
  byMethod: Partial<Record<ArPaymentMethod, number>>;
  distinctPayers: number;
  distinctJobs: number;
}

export interface PortfolioCustomerPaymentSnapshotInputs {
  arPayments: ArPayment[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
  /** Log year (Jan 1 - Dec 31). Defaults to year of asOf. */
  logYear?: number;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function canonName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(llc|inc|corp|co)\b\.?/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function buildPortfolioCustomerPaymentSnapshot(
  inputs: PortfolioCustomerPaymentSnapshotInputs,
): PortfolioCustomerPaymentSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const logYear = inputs.logYear ?? Number(asOf.slice(0, 4));

  const byKind = new Map<ArPaymentKind, number>();
  const byMethod = new Map<ArPaymentMethod, number>();
  const payers = new Set<string>();
  const jobs = new Set<string>();

  let totalPayments = 0;
  let ytdPayments = 0;
  let totalCents = 0;
  let ytdCents = 0;

  for (const p of inputs.arPayments) {
    if (p.receivedOn > asOf) continue;
    totalPayments += 1;
    totalCents += p.amountCents;
    byKind.set(p.kind, (byKind.get(p.kind) ?? 0) + 1);
    byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + 1);
    if (p.payerName) {
      const c = canonName(p.payerName);
      if (c) payers.add(c);
    }
    jobs.add(p.jobId);
    if (Number(p.receivedOn.slice(0, 4)) === logYear) {
      ytdPayments += 1;
      ytdCents += p.amountCents;
    }
  }

  const kOut: Partial<Record<ArPaymentKind, number>> = {};
  for (const [k, v] of byKind) kOut[k] = v;
  const mOut: Partial<Record<ArPaymentMethod, number>> = {};
  for (const [k, v] of byMethod) mOut[k] = v;

  return {
    asOf,
    ytdLogYear: logYear,
    totalPayments,
    ytdPayments,
    totalCents,
    ytdCents,
    byKind: kOut,
    byMethod: mOut,
    distinctPayers: payers.size,
    distinctJobs: jobs.size,
  };
}
