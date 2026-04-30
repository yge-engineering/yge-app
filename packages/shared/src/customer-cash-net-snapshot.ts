// Customer-anchored cash net snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency
// for AP and via payer/invoice for AR), as-of today, sum AR
// receipts (cash in) minus AP disbursements (cash out, ex
// voided) tied to their jobs. Drives the right-now per-
// customer net-cash overview — "are we making money on this
// owner's projects".
//
// Pure derivation. No persisted records.

import type { ApPayment } from './ap-payment';
import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';
import type { Job } from './job';

export interface CustomerCashNetSnapshotResult {
  asOf: string;
  customerName: string;
  totalReceiptsCents: number;
  totalDisbursementsCents: number;
  netCents: number;
  receiptCount: number;
  disbursementCount: number;
}

export interface CustomerCashNetSnapshotInputs {
  customerName: string;
  arPayments: ArPayment[];
  arInvoices: ArInvoice[];
  apPayments: ApPayment[];
  jobs: Job[];
  /** Mapping AP invoice id → job id. */
  apInvoiceJobByInvoiceId?: Record<string, string>;
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

export function buildCustomerCashNetSnapshot(
  inputs: CustomerCashNetSnapshotInputs,
): CustomerCashNetSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);
  const apMap = inputs.apInvoiceJobByInvoiceId ?? {};

  // Jobs belonging to this customer.
  const customerJobIds = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobIds.add(j.id);
  }

  // Invoice → customerName (canonical) lookup for AR.
  const invoiceCustomer = new Map<string, string>();
  for (const inv of inputs.arInvoices) invoiceCustomer.set(inv.id, norm(inv.customerName));

  let totalReceiptsCents = 0;
  let receiptCount = 0;
  for (const p of inputs.arPayments) {
    if (p.receivedOn > asOf) continue;
    const payerMatch = norm(p.payerName) === target;
    const invMatch = invoiceCustomer.get(p.arInvoiceId) === target;
    const jobMatch = customerJobIds.has(p.jobId);
    if (!payerMatch && !invMatch && !jobMatch) continue;
    totalReceiptsCents += p.amountCents;
    receiptCount += 1;
  }

  let totalDisbursementsCents = 0;
  let disbursementCount = 0;
  for (const p of inputs.apPayments) {
    if (p.paidOn > asOf) continue;
    if (p.voided) continue;
    const apJobId = apMap[p.apInvoiceId];
    if (apJobId == null) continue;
    if (!customerJobIds.has(apJobId)) continue;
    totalDisbursementsCents += p.amountCents;
    disbursementCount += 1;
  }

  return {
    asOf,
    customerName: inputs.customerName,
    totalReceiptsCents,
    totalDisbursementsCents,
    netCents: totalReceiptsCents - totalDisbursementsCents,
    receiptCount,
    disbursementCount,
  };
}
