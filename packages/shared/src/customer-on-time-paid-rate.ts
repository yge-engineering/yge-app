// Per-customer on-time AR payment rate.
//
// Plain English: for every fully-paid invoice that had a due
// date, was the final dollar in on or before the due date?
// Roll the answer up by customer to spot who chronically pays
// late so we can tighten terms or escalate sooner.
//
// "Final paid on" = latest receivedOn among the AR payments
// applied to that invoice. An invoice is considered settled if
// status is PAID or paidCents >= totalCents.
//
// Per row: invoicesConsidered, onTimeCount, lateCount,
// onTimeRate (0..1), avgDaysLate (over late only), maxDaysLate.
// Sort: most late invoices first, ties by avgDaysLate desc.
//
// Different from customer-payment-lag (avg days from invoice
// to payment regardless of due date), customer-payment-velocity
// (timing buckets), and customer-prompt-pay-claim (PCC §7107
// statutory window). This is the contractual due-date check.
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';

export interface CustomerOnTimePaidRow {
  customerName: string;
  invoicesConsidered: number;
  onTimeCount: number;
  lateCount: number;
  onTimeRate: number;
  avgDaysLate: number;
  maxDaysLate: number;
}

export interface CustomerOnTimePaidRollup {
  customersConsidered: number;
  invoicesConsidered: number;
  onTimeCount: number;
  lateCount: number;
  portfolioOnTimeRate: number;
  portfolioAvgDaysLate: number;
}

export interface CustomerOnTimePaidInputs {
  arInvoices: ArInvoice[];
  arPayments: ArPayment[];
  /** Optional yyyy-mm-dd window applied to dueDate. */
  fromDate?: string;
  toDate?: string;
}

export function buildCustomerOnTimePaidRate(
  inputs: CustomerOnTimePaidInputs,
): {
  rollup: CustomerOnTimePaidRollup;
  rows: CustomerOnTimePaidRow[];
} {
  // Index payments by AR invoice id, latest receivedOn wins.
  const lastPayDate = new Map<string, string>();
  for (const p of inputs.arPayments) {
    const cur = lastPayDate.get(p.arInvoiceId);
    if (!cur || p.receivedOn > cur) lastPayDate.set(p.arInvoiceId, p.receivedOn);
  }

  type Acc = {
    display: string;
    invoices: number;
    onTime: number;
    late: number;
    daysLateSum: number;
    maxDaysLate: number;
  };
  const accs = new Map<string, Acc>();

  for (const inv of inputs.arInvoices) {
    if (!inv.dueDate) continue;
    if (inputs.fromDate && inv.dueDate < inputs.fromDate) continue;
    if (inputs.toDate && inv.dueDate > inputs.toDate) continue;
    const settled = inv.status === 'PAID' || inv.paidCents >= inv.totalCents;
    if (!settled) continue;
    const finalOn = lastPayDate.get(inv.id);
    if (!finalOn) continue;
    const key = canonicalize(inv.customerName);
    const acc = accs.get(key) ?? {
      display: inv.customerName,
      invoices: 0,
      onTime: 0,
      late: 0,
      daysLateSum: 0,
      maxDaysLate: 0,
    };
    acc.invoices += 1;
    if (finalOn <= inv.dueDate) {
      acc.onTime += 1;
    } else {
      const days = daysBetween(inv.dueDate, finalOn);
      acc.late += 1;
      acc.daysLateSum += days;
      if (days > acc.maxDaysLate) acc.maxDaysLate = days;
    }
    accs.set(key, acc);
  }

  const rows: CustomerOnTimePaidRow[] = [];
  let totalInvoices = 0;
  let totalOnTime = 0;
  let totalLate = 0;
  let totalDaysLate = 0;

  for (const acc of accs.values()) {
    const onTimeRate = acc.invoices === 0
      ? 0
      : Math.round((acc.onTime / acc.invoices) * 10_000) / 10_000;
    const avgDaysLate = acc.late === 0
      ? 0
      : Math.round((acc.daysLateSum / acc.late) * 100) / 100;
    rows.push({
      customerName: acc.display,
      invoicesConsidered: acc.invoices,
      onTimeCount: acc.onTime,
      lateCount: acc.late,
      onTimeRate,
      avgDaysLate,
      maxDaysLate: acc.maxDaysLate,
    });
    totalInvoices += acc.invoices;
    totalOnTime += acc.onTime;
    totalLate += acc.late;
    totalDaysLate += acc.daysLateSum;
  }

  rows.sort((a, b) => {
    if (b.lateCount !== a.lateCount) return b.lateCount - a.lateCount;
    return b.avgDaysLate - a.avgDaysLate;
  });

  const portfolioOnTimeRate = totalInvoices === 0
    ? 0
    : Math.round((totalOnTime / totalInvoices) * 10_000) / 10_000;
  const portfolioAvgDaysLate = totalLate === 0
    ? 0
    : Math.round((totalDaysLate / totalLate) * 100) / 100;

  return {
    rollup: {
      customersConsidered: rows.length,
      invoicesConsidered: totalInvoices,
      onTimeCount: totalOnTime,
      lateCount: totalLate,
      portfolioOnTimeRate,
      portfolioAvgDaysLate,
    },
    rows,
  };
}

function canonicalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,'"`]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(llc|inc|incorporated|corp|corporation|co|company|ltd|limited)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = Date.parse(fromYmd + 'T00:00:00Z');
  const b = Date.parse(toYmd + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}
