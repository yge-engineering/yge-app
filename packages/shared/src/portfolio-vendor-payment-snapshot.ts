// Portfolio vendor payment (AP cash disbursements) snapshot.
//
// Plain English: as-of today, count AP payments, sum cents
// excluding voided, separate cleared vs scheduled, break down
// by method, count distinct vendors, and surface YTD totals.
// Drives the right-now cash-paid + check-register overview.
//
// Pure derivation. No persisted records.

import type { ApPayment, ApPaymentMethod } from './ap-payment';

export interface PortfolioVendorPaymentSnapshotResult {
  asOf: string;
  ytdLogYear: number;
  totalPayments: number;
  ytdPayments: number;
  totalCents: number;
  ytdCents: number;
  clearedCents: number;
  scheduledCents: number;
  voidedCount: number;
  byMethod: Partial<Record<ApPaymentMethod, number>>;
  distinctVendors: number;
}

export interface PortfolioVendorPaymentSnapshotInputs {
  apPayments: ApPayment[];
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

export function buildPortfolioVendorPaymentSnapshot(
  inputs: PortfolioVendorPaymentSnapshotInputs,
): PortfolioVendorPaymentSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const logYear = inputs.logYear ?? Number(asOf.slice(0, 4));

  const byMethod = new Map<ApPaymentMethod, number>();
  const vendors = new Set<string>();

  let totalPayments = 0;
  let ytdPayments = 0;
  let totalCents = 0;
  let ytdCents = 0;
  let clearedCents = 0;
  let scheduledCents = 0;
  let voidedCount = 0;

  for (const p of inputs.apPayments) {
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
    if (p.vendorName) {
      const c = canonName(p.vendorName);
      if (c) vendors.add(c);
    }
    if (Number(p.paidOn.slice(0, 4)) === logYear) {
      ytdPayments += 1;
      ytdCents += p.amountCents;
    }
  }

  const out: Partial<Record<ApPaymentMethod, number>> = {};
  for (const [k, v] of byMethod) out[k] = v;

  return {
    asOf,
    ytdLogYear: logYear,
    totalPayments,
    ytdPayments,
    totalCents,
    ytdCents,
    clearedCents,
    scheduledCents,
    voidedCount,
    byMethod: out,
    distinctVendors: vendors.size,
  };
}
