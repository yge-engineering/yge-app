// Vendor payment velocity report.
//
// Plain English: every vendor has payment terms (Net 30, Net 60,
// Due-on-Receipt, etc.). When we pay an invoice, we either pay it
// EARLY (good for vendor relationships, sometimes earns a discount),
// ON TIME, or LATE (hurts the relationship and can put us on
// COD-only with that vendor). This walks paid invoices and surfaces:
//   - average days-to-pay per vendor
//   - whether we're paying inside the terms window or past it
//   - which vendors we consistently pay late (relationship risk)
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Vendor, VendorPaymentTerms } from './vendor';

export type PaymentVelocityFlag =
  | 'EARLY'        // paid > 5 days before due date
  | 'ON_TIME'      // paid within 5 days either side of due date
  | 'LATE'         // paid 1-15 days past due
  | 'VERY_LATE';   // paid 16+ days past due

export interface VendorPaymentVelocityRow {
  vendorId: string | null;
  vendorName: string;
  invoicesPaid: number;
  totalPaidCents: number;
  /** Avg days from invoice date to paid date (positive = days). */
  avgDaysToPay: number;
  /** Avg days vs due date. Negative = paid early; positive = paid late. */
  avgDaysVsDue: number;
  /** Counts of each velocity flag among paid invoices with a due date. */
  earlyCount: number;
  onTimeCount: number;
  lateCount: number;
  veryLateCount: number;
  /** Worst flag observed across this vendor's paid invoices. */
  worstFlag: PaymentVelocityFlag;
}

export interface VendorPaymentVelocityRollup {
  vendorsConsidered: number;
  invoicesConsidered: number;
  /** Vendors we currently pay late on average (avgDaysVsDue > 5). */
  vendorsRunningLate: number;
  blendedAvgDaysToPay: number;
  blendedAvgDaysVsDue: number;
}

export interface VendorPaymentVelocityReport {
  rollup: VendorPaymentVelocityRollup;
  rows: VendorPaymentVelocityRow[];
}

export interface VendorPaymentVelocityInputs {
  vendors: Vendor[];
  apInvoices: ApInvoice[];
}

export function buildVendorPaymentVelocity(
  inputs: VendorPaymentVelocityInputs,
): VendorPaymentVelocityReport {
  const byName = new Map<string, Vendor>();
  for (const v of inputs.vendors) {
    byName.set(normalize(v.legalName), v);
    if (v.dbaName) byName.set(normalize(v.dbaName), v);
  }

  type Bucket = {
    vendorId: string | null;
    vendorName: string;
    paidTotalCents: number;
    daysToPaySum: number;
    daysVsDueSum: number;
    daysVsDueCount: number;
    invoicesPaid: number;
    early: number;
    onTime: number;
    late: number;
    veryLate: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const inv of inputs.apInvoices) {
    if (inv.status !== 'PAID') continue;
    if (!inv.paidAt) continue;
    const invDate = parseDate(inv.invoiceDate);
    const paidDate = parseDate(inv.paidAt);
    if (!invDate || !paidDate) continue;

    const v = byName.get(normalize(inv.vendorName));
    const key = v?.id ?? `name:${normalize(inv.vendorName)}`;
    const bucket = buckets.get(key) ?? {
      vendorId: v?.id ?? null,
      vendorName: v?.dbaName ?? v?.legalName ?? inv.vendorName,
      paidTotalCents: 0,
      daysToPaySum: 0,
      daysVsDueSum: 0,
      daysVsDueCount: 0,
      invoicesPaid: 0,
      early: 0,
      onTime: 0,
      late: 0,
      veryLate: 0,
    };

    const daysToPay = daysBetween(invDate, paidDate);
    bucket.daysToPaySum += daysToPay;
    bucket.invoicesPaid += 1;
    bucket.paidTotalCents += inv.totalCents;

    // Use the explicit dueDate if set; otherwise derive from vendor terms.
    let dueDate = inv.dueDate ? parseDate(inv.dueDate) : null;
    if (!dueDate && v) {
      const offset = termsOffsetDays(v.paymentTerms);
      if (offset != null) {
        dueDate = new Date(invDate.getTime() + offset * 24 * 60 * 60 * 1000);
      }
    }
    if (dueDate) {
      const delta = daysBetween(dueDate, paidDate); // negative = early
      bucket.daysVsDueSum += delta;
      bucket.daysVsDueCount += 1;
      if (delta < -5) bucket.early += 1;
      else if (delta <= 5) bucket.onTime += 1;
      else if (delta <= 15) bucket.late += 1;
      else bucket.veryLate += 1;
    }

    buckets.set(key, bucket);
  }

  const rows: VendorPaymentVelocityRow[] = [];
  let blendedDaysToPay = 0;
  let blendedDaysVsDue = 0;
  let blendedDueCount = 0;
  let totalInvoices = 0;
  let lateOnAverage = 0;

  for (const b of buckets.values()) {
    const avgDaysToPay = b.invoicesPaid === 0 ? 0 : b.daysToPaySum / b.invoicesPaid;
    const avgDaysVsDue = b.daysVsDueCount === 0 ? 0 : b.daysVsDueSum / b.daysVsDueCount;
    const worstFlag = pickWorst(b);
    rows.push({
      vendorId: b.vendorId,
      vendorName: b.vendorName,
      invoicesPaid: b.invoicesPaid,
      totalPaidCents: b.paidTotalCents,
      avgDaysToPay: round1(avgDaysToPay),
      avgDaysVsDue: round1(avgDaysVsDue),
      earlyCount: b.early,
      onTimeCount: b.onTime,
      lateCount: b.late,
      veryLateCount: b.veryLate,
      worstFlag,
    });
    blendedDaysToPay += b.daysToPaySum;
    blendedDaysVsDue += b.daysVsDueSum;
    blendedDueCount += b.daysVsDueCount;
    totalInvoices += b.invoicesPaid;
    if (avgDaysVsDue > 5) lateOnAverage += 1;
  }

  // Worst (most-late) first.
  rows.sort((a, b) => b.avgDaysVsDue - a.avgDaysVsDue);

  return {
    rollup: {
      vendorsConsidered: rows.length,
      invoicesConsidered: totalInvoices,
      vendorsRunningLate: lateOnAverage,
      blendedAvgDaysToPay:
        totalInvoices === 0 ? 0 : round1(blendedDaysToPay / totalInvoices),
      blendedAvgDaysVsDue:
        blendedDueCount === 0 ? 0 : round1(blendedDaysVsDue / blendedDueCount),
    },
    rows,
  };
}

function pickWorst(b: {
  early: number;
  onTime: number;
  late: number;
  veryLate: number;
}): PaymentVelocityFlag {
  if (b.veryLate > 0) return 'VERY_LATE';
  if (b.late > 0) return 'LATE';
  if (b.onTime > 0) return 'ON_TIME';
  return 'EARLY';
}

function termsOffsetDays(t: VendorPaymentTerms): number | null {
  switch (t) {
    case 'NET_10': return 10;
    case 'NET_15': return 15;
    case 'NET_30': return 30;
    case 'NET_45': return 45;
    case 'NET_60': return 60;
    case 'DUE_ON_RECEIPT': return 0;
    case 'COD': return 0;
    case 'PREPAID': return 0;
    case 'OTHER': return null;
  }
}

function parseDate(s: string): Date | null {
  // Accept yyyy-mm-dd or full ISO; UTC-anchor.
  const head = s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(head)) return null;
  const d = new Date(`${head}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,'"`]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(llc|inc|incorporated|corp|corporation|co|company|ltd|limited)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
