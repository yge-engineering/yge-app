// Customer-anchored AR payment snapshot.
//
// Plain English: for one customer (matched against
// arInvoice.customerName via canonicalized lookup), as-of
// today, count payments, sum cents, kind + method mix, YTD
// totals, last received date, distinct jobs.
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';
import type { ArPayment, ArPaymentKind, ArPaymentMethod } from './ar-payment';

export interface CustomerPaymentSnapshotResult {
  asOf: string;
  customerName: string;
  ytdLogYear: number;
  totalPayments: number;
  ytdPayments: number;
  totalCents: number;
  ytdCents: number;
  byKind: Partial<Record<ArPaymentKind, number>>;
  byMethod: Partial<Record<ArPaymentMethod, number>>;
  distinctJobs: number;
  lastReceivedDate: string | null;
}

export interface CustomerPaymentSnapshotInputs {
  customerName: string;
  arPayments: ArPayment[];
  arInvoices: ArInvoice[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
  /** Log year. Defaults to year of asOf. */
  logYear?: number;
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

export function buildCustomerPaymentSnapshot(
  inputs: CustomerPaymentSnapshotInputs,
): CustomerPaymentSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const logYear = inputs.logYear ?? Number(asOf.slice(0, 4));
  const target = norm(inputs.customerName);

  const invoiceCustomer = new Map<string, string>();
  for (const inv of inputs.arInvoices) invoiceCustomer.set(inv.id, norm(inv.customerName));

  const byKind = new Map<ArPaymentKind, number>();
  const byMethod = new Map<ArPaymentMethod, number>();
  const jobs = new Set<string>();
  let totalPayments = 0;
  let ytdPayments = 0;
  let totalCents = 0;
  let ytdCents = 0;
  let lastReceivedDate: string | null = null;

  for (const p of inputs.arPayments) {
    if (p.receivedOn > asOf) continue;
    const payerMatch = norm(p.payerName) === target;
    const invMatch = invoiceCustomer.get(p.arInvoiceId) === target;
    if (!payerMatch && !invMatch) continue;
    totalPayments += 1;
    totalCents += p.amountCents;
    byKind.set(p.kind, (byKind.get(p.kind) ?? 0) + 1);
    byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + 1);
    jobs.add(p.jobId);
    if (Number(p.receivedOn.slice(0, 4)) === logYear) {
      ytdPayments += 1;
      ytdCents += p.amountCents;
    }
    if (lastReceivedDate == null || p.receivedOn > lastReceivedDate) lastReceivedDate = p.receivedOn;
  }

  const kOut: Partial<Record<ArPaymentKind, number>> = {};
  for (const [k, v] of byKind) kOut[k] = v;
  const mOut: Partial<Record<ArPaymentMethod, number>> = {};
  for (const [k, v] of byMethod) mOut[k] = v;

  return {
    asOf,
    customerName: inputs.customerName,
    ytdLogYear: logYear,
    totalPayments,
    ytdPayments,
    totalCents,
    ytdCents,
    byKind: kOut,
    byMethod: mOut,
    distinctJobs: jobs.size,
    lastReceivedDate,
  };
}
