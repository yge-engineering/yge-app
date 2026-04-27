// Customer payment velocity report.
//
// Plain English: AR-side mirror of vendor-payment-velocity. For each
// customer/agency, walks the AR invoices that have actually been
// paid and surfaces:
//   - average days from sent date to fully-paid date
//   - average days vs. due date (negative = paid early; positive =
//     paid late — and on a public job, every day late is statutory
//     interest exposure under §20104.50)
//   - flag counts: EARLY / ON_TIME / LATE / VERY_LATE
//
// Drives "which agencies are reliable payers vs. which need a
// follow-up call early?" Shows a different view than DSO — DSO is
// average-days-outstanding, this is per-payment behavior.
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';

export type CustomerVelocityFlag = 'EARLY' | 'ON_TIME' | 'LATE' | 'VERY_LATE';

export interface CustomerPaymentVelocityRow {
  customerName: string;
  invoicesPaid: number;
  totalPaidCents: number;
  /** Avg days from sentAt (or invoiceDate) to lastPaymentAt. */
  avgDaysToPay: number;
  /** Avg days vs. due date (negative = early; positive = late). */
  avgDaysVsDue: number;
  earlyCount: number;
  onTimeCount: number;
  lateCount: number;
  veryLateCount: number;
  worstFlag: CustomerVelocityFlag;
}

export interface CustomerPaymentVelocityRollup {
  customersConsidered: number;
  invoicesConsidered: number;
  /** Customers averaging >5 days late on payment vs due date. */
  customersRunningLate: number;
  blendedAvgDaysToPay: number;
  blendedAvgDaysVsDue: number;
}

export interface CustomerPaymentVelocityInputs {
  arInvoices: ArInvoice[];
  /** Default Net-30 fallback when invoice has no dueDate. */
  fallbackTermsDays?: number;
}

export function buildCustomerPaymentVelocity(
  inputs: CustomerPaymentVelocityInputs,
): {
  rollup: CustomerPaymentVelocityRollup;
  rows: CustomerPaymentVelocityRow[];
} {
  const fallbackDays = inputs.fallbackTermsDays ?? 30;

  type Bucket = {
    customerName: string;
    invoicesPaid: number;
    paidTotalCents: number;
    daysToPaySum: number;
    daysVsDueSum: number;
    daysVsDueCount: number;
    early: number;
    onTime: number;
    late: number;
    veryLate: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const inv of inputs.arInvoices) {
    if (inv.status !== 'PAID') continue;
    if (!inv.lastPaymentAt) continue;
    const sentDate = parseDate(inv.sentAt) ?? parseDate(inv.invoiceDate);
    const paidDate = parseDate(inv.lastPaymentAt);
    if (!sentDate || !paidDate) continue;

    const key = inv.customerName.trim().toLowerCase();
    const b = buckets.get(key) ?? {
      customerName: inv.customerName.trim(),
      invoicesPaid: 0,
      paidTotalCents: 0,
      daysToPaySum: 0,
      daysVsDueSum: 0,
      daysVsDueCount: 0,
      early: 0,
      onTime: 0,
      late: 0,
      veryLate: 0,
    };
    b.invoicesPaid += 1;
    b.paidTotalCents += inv.totalCents;
    b.daysToPaySum += daysBetween(sentDate, paidDate);

    let dueDate = inv.dueDate ? parseDate(inv.dueDate) : null;
    if (!dueDate) {
      dueDate = new Date(sentDate.getTime() + fallbackDays * 24 * 60 * 60 * 1000);
    }
    const delta = daysBetween(dueDate, paidDate);
    b.daysVsDueSum += delta;
    b.daysVsDueCount += 1;
    if (delta < -5) b.early += 1;
    else if (delta <= 5) b.onTime += 1;
    else if (delta <= 15) b.late += 1;
    else b.veryLate += 1;

    buckets.set(key, b);
  }

  const rows: CustomerPaymentVelocityRow[] = [];
  let blendedDaysToPaySum = 0;
  let blendedDaysVsDueSum = 0;
  let blendedDueCount = 0;
  let totalInvoices = 0;
  let lateOnAvg = 0;

  for (const b of buckets.values()) {
    const avgPay = b.invoicesPaid === 0 ? 0 : b.daysToPaySum / b.invoicesPaid;
    const avgVsDue = b.daysVsDueCount === 0 ? 0 : b.daysVsDueSum / b.daysVsDueCount;
    rows.push({
      customerName: b.customerName,
      invoicesPaid: b.invoicesPaid,
      totalPaidCents: b.paidTotalCents,
      avgDaysToPay: round1(avgPay),
      avgDaysVsDue: round1(avgVsDue),
      earlyCount: b.early,
      onTimeCount: b.onTime,
      lateCount: b.late,
      veryLateCount: b.veryLate,
      worstFlag: pickWorst(b),
    });
    blendedDaysToPaySum += b.daysToPaySum;
    blendedDaysVsDueSum += b.daysVsDueSum;
    blendedDueCount += b.daysVsDueCount;
    totalInvoices += b.invoicesPaid;
    if (avgVsDue > 5) lateOnAvg += 1;
  }

  rows.sort((a, b) => b.avgDaysVsDue - a.avgDaysVsDue);

  return {
    rollup: {
      customersConsidered: rows.length,
      invoicesConsidered: totalInvoices,
      customersRunningLate: lateOnAvg,
      blendedAvgDaysToPay:
        totalInvoices === 0 ? 0 : round1(blendedDaysToPaySum / totalInvoices),
      blendedAvgDaysVsDue:
        blendedDueCount === 0 ? 0 : round1(blendedDaysVsDueSum / blendedDueCount),
    },
    rows,
  };
}

function pickWorst(b: { early: number; onTime: number; late: number; veryLate: number }): CustomerVelocityFlag {
  if (b.veryLate > 0) return 'VERY_LATE';
  if (b.late > 0) return 'LATE';
  if (b.onTime > 0) return 'ON_TIME';
  return 'EARLY';
}

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
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
