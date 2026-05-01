// Per-job AP outflow rollup.
//
// Plain English: bucket non-voided AP payments by jobId via the
// associated AP invoice. Useful for "we paid Granite \$125k on
// Sulphur Springs this year" cost-report reconciliation.
//
// "Match" = link AP payment → AP invoice by apInvoiceId, then
// take the invoice's jobId (when set).
//
// Per row: jobId, total, totalCents, byMethod, lastPaidOn.
//
// Sort by totalCents desc.
//
// Different from ap-payment-monthly (per-month, no job axis),
// vendor-spend-by-job (AP invoices, not payments).
//
// Pure derivation. No persisted records.

import type { ApInvoice, ApPaymentMethod } from './ap-invoice';
import type { ApPayment } from './ap-payment';

export interface ApPaymentByJobRow {
  jobId: string;
  total: number;
  totalCents: number;
  byMethod: Partial<Record<ApPaymentMethod, number>>;
  lastPaidOn: string | null;
}

export interface ApPaymentByJobRollup {
  jobsConsidered: number;
  totalPayments: number;
  totalCents: number;
  unattributed: number;
  voidedSkipped: number;
}

export interface ApPaymentByJobInputs {
  apInvoices: ApInvoice[];
  apPayments: ApPayment[];
  /** Optional yyyy-mm-dd window applied to paidOn. */
  fromDate?: string;
  toDate?: string;
}

export function buildApPaymentByJob(
  inputs: ApPaymentByJobInputs,
): {
  rollup: ApPaymentByJobRollup;
  rows: ApPaymentByJobRow[];
} {
  const jobByInvoice = new Map<string, string>();
  for (const inv of inputs.apInvoices) {
    if (inv.jobId) jobByInvoice.set(inv.id, inv.jobId);
  }

  type Acc = {
    jobId: string;
    total: number;
    cents: number;
    byMethod: Map<ApPaymentMethod, number>;
    lastPaidOn: string | null;
  };
  const accs = new Map<string, Acc>();
  let portfolioTotal = 0;
  let portfolioCents = 0;
  let unattributed = 0;
  let voidedSkipped = 0;

  for (const p of inputs.apPayments) {
    if (p.voided) {
      voidedSkipped += 1;
      continue;
    }
    if (inputs.fromDate && p.paidOn < inputs.fromDate) continue;
    if (inputs.toDate && p.paidOn > inputs.toDate) continue;
    portfolioTotal += 1;
    portfolioCents += p.amountCents;
    const jobId = jobByInvoice.get(p.apInvoiceId);
    if (!jobId) {
      unattributed += 1;
      continue;
    }
    const acc = accs.get(jobId) ?? {
      jobId,
      total: 0,
      cents: 0,
      byMethod: new Map<ApPaymentMethod, number>(),
      lastPaidOn: null,
    };
    acc.total += 1;
    acc.cents += p.amountCents;
    acc.byMethod.set(p.method, (acc.byMethod.get(p.method) ?? 0) + 1);
    if (!acc.lastPaidOn || p.paidOn > acc.lastPaidOn) acc.lastPaidOn = p.paidOn;
    accs.set(jobId, acc);
  }

  const rows: ApPaymentByJobRow[] = [];
  for (const acc of accs.values()) {
    const obj: Partial<Record<ApPaymentMethod, number>> = {};
    for (const [k, v] of acc.byMethod.entries()) obj[k] = v;
    rows.push({
      jobId: acc.jobId,
      total: acc.total,
      totalCents: acc.cents,
      byMethod: obj,
      lastPaidOn: acc.lastPaidOn,
    });
  }

  rows.sort((a, b) => b.totalCents - a.totalCents);

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalPayments: portfolioTotal,
      totalCents: portfolioCents,
      unattributed,
      voidedSkipped,
    },
    rows,
  };
}
