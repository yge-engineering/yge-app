// Vendor-anchored per-job AP payment detail snapshot.
//
// Plain English: for one vendor (matched by canonicalized
// vendorName), return one row per job we paid them on. Job is
// resolved by looking up the AP invoice by id. Rows include
// payment count, total cents paid, voided count, cleared count,
// payment method mix, last payment date. Sorted by total paid
// desc.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { ApPayment } from './ap-payment';

export interface VendorPaymentDetailRow {
  jobId: string;
  paymentCount: number;
  totalCents: number;
  voidedCount: number;
  voidedCents: number;
  clearedCount: number;
  checkCount: number;
  achCount: number;
  wireCount: number;
  creditCardCount: number;
  cashCount: number;
  lastPaymentDate: string | null;
}

export interface VendorPaymentDetailSnapshotResult {
  asOf: string;
  vendorName: string;
  rows: VendorPaymentDetailRow[];
}

export interface VendorPaymentDetailSnapshotInputs {
  vendorName: string;
  apPayments: ApPayment[];
  /** Needed to resolve jobId from each payment's apInvoiceId. */
  apInvoices: ApInvoice[];
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

function canonVendor(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,&'()]/g, ' ')
    .replace(/\b(llc|inc|corp|co|ltd|company)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildVendorPaymentDetailSnapshot(
  inputs: VendorPaymentDetailSnapshotInputs,
): VendorPaymentDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = canonVendor(inputs.vendorName);

  // Resolve apInvoiceId → jobId once up front.
  const invoiceJob = new Map<string, string | undefined>();
  for (const inv of inputs.apInvoices) invoiceJob.set(inv.id, inv.jobId);

  type Acc = {
    count: number;
    total: number;
    voidedCount: number;
    voidedCents: number;
    cleared: number;
    check: number;
    ach: number;
    wire: number;
    credit: number;
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
        voidedCount: 0,
        voidedCents: 0,
        cleared: 0,
        check: 0,
        ach: 0,
        wire: 0,
        credit: 0,
        cash: 0,
        lastDate: null,
      };
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const p of inputs.apPayments) {
    if (canonVendor(p.vendorName) !== target) continue;
    if (p.paidOn > asOf) continue;
    const jobId = invoiceJob.get(p.apInvoiceId);
    if (!jobId) continue;
    const a = getAcc(jobId);
    a.count += 1;
    if (p.voided) {
      a.voidedCount += 1;
      a.voidedCents += p.amountCents;
    } else {
      a.total += p.amountCents;
    }
    if (p.cleared) a.cleared += 1;
    switch (p.method) {
      case 'CHECK': a.check += 1; break;
      case 'ACH': a.ach += 1; break;
      case 'WIRE': a.wire += 1; break;
      case 'CREDIT_CARD': a.credit += 1; break;
      case 'CASH': a.cash += 1; break;
    }
    if (a.lastDate == null || p.paidOn > a.lastDate) a.lastDate = p.paidOn;
  }

  const rows: VendorPaymentDetailRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
      paymentCount: a.count,
      totalCents: a.total,
      voidedCount: a.voidedCount,
      voidedCents: a.voidedCents,
      clearedCount: a.cleared,
      checkCount: a.check,
      achCount: a.ach,
      wireCount: a.wire,
      creditCardCount: a.credit,
      cashCount: a.cash,
      lastPaymentDate: a.lastDate,
    }))
    .sort((a, b) => b.totalCents - a.totalCents || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    vendorName: inputs.vendorName,
    rows,
  };
}
