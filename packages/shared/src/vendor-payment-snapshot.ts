// Vendor-anchored AP payment snapshot.
//
// Plain English: for one vendor (matched by canonicalized
// name), as-of today, count payments, sum cents (ex voided),
// separate cleared vs scheduled, surface YTD totals + last
// paid date + voided count. Drives the right-now per-vendor
// cash-paid overview.
//
// Pure derivation. No persisted records.

import type { ApPayment, ApPaymentMethod } from './ap-payment';

export interface VendorPaymentSnapshotResult {
  asOf: string;
  vendorName: string;
  ytdLogYear: number;
  totalPayments: number;
  ytdPayments: number;
  totalCents: number;
  ytdCents: number;
  clearedCents: number;
  scheduledCents: number;
  voidedCount: number;
  byMethod: Partial<Record<ApPaymentMethod, number>>;
  lastPaidDate: string | null;
}

export interface VendorPaymentSnapshotInputs {
  vendorName: string;
  apPayments: ApPayment[];
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

function normVendor(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(llc|inc|corp|co|ltd|company)\b/g, '')
    .replace(/[.,&'()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildVendorPaymentSnapshot(
  inputs: VendorPaymentSnapshotInputs,
): VendorPaymentSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const logYear = inputs.logYear ?? Number(asOf.slice(0, 4));
  const target = normVendor(inputs.vendorName);

  const byMethod = new Map<ApPaymentMethod, number>();
  let totalPayments = 0;
  let ytdPayments = 0;
  let totalCents = 0;
  let ytdCents = 0;
  let clearedCents = 0;
  let scheduledCents = 0;
  let voidedCount = 0;
  let lastPaidDate: string | null = null;

  for (const p of inputs.apPayments) {
    if (normVendor(p.vendorName) !== target) continue;
    if (p.paidOn > asOf) continue;
    if (p.voided) {
      voidedCount += 1;
      continue;
    }
    totalPayments += 1;
    totalCents += p.amountCents;
    if (p.cleared) clearedCents += p.amountCents;
    else scheduledCents += p.amountCents;
    byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + 1);
    if (Number(p.paidOn.slice(0, 4)) === logYear) {
      ytdPayments += 1;
      ytdCents += p.amountCents;
    }
    if (lastPaidDate == null || p.paidOn > lastPaidDate) lastPaidDate = p.paidOn;
  }

  const out: Partial<Record<ApPaymentMethod, number>> = {};
  for (const [k, v] of byMethod) out[k] = v;

  return {
    asOf,
    vendorName: inputs.vendorName,
    ytdLogYear: logYear,
    totalPayments,
    ytdPayments,
    totalCents,
    ytdCents,
    clearedCents,
    scheduledCents,
    voidedCount,
    byMethod: out,
    lastPaidDate,
  };
}
