// Customer on-time payment rate by month.
//
// Plain English: bucket fully-paid invoices that had a due date
// by yyyy-mm of dueDate, then compute the on-time rate for each
// month. Useful for spotting when a customer's pay performance
// drifts (cash crunch on their side, agency leadership turnover,
// etc.).
//
// "Final paid on" = latest receivedOn among AR payments
// applied to that invoice. Settled = status PAID or paidCents
// >= totalCents.
//
// Per row: month, invoicesConsidered, onTimeCount, lateCount,
// onTimeRate, avgDaysLate, distinctCustomers.
//
// Sort by month asc.
//
// Different from customer-on-time-paid-rate (per-customer
// rollup), customer-payment-lag (avg days from invoice to
// payment), customer-payment-velocity (timing buckets).
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';

export interface CustomerOnTimeMonthlyRow {
  month: string;
  invoicesConsidered: number;
  onTimeCount: number;
  lateCount: number;
  onTimeRate: number;
  avgDaysLate: number;
  distinctCustomers: number;
}

export interface CustomerOnTimeMonthlyRollup {
  monthsConsidered: number;
  totalInvoices: number;
  portfolioOnTimeRate: number;
}

export interface CustomerOnTimeMonthlyInputs {
  arInvoices: ArInvoice[];
  arPayments: ArPayment[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildCustomerOnTimeMonthly(
  inputs: CustomerOnTimeMonthlyInputs,
): {
  rollup: CustomerOnTimeMonthlyRollup;
  rows: CustomerOnTimeMonthlyRow[];
} {
  const lastPayDate = new Map<string, string>();
  for (const p of inputs.arPayments) {
    const cur = lastPayDate.get(p.arInvoiceId);
    if (!cur || p.receivedOn > cur) lastPayDate.set(p.arInvoiceId, p.receivedOn);
  }

  type Bucket = {
    month: string;
    invoices: number;
    onTime: number;
    late: number;
    daysLateSum: number;
    customers: Set<string>;
  };
  const fresh = (month: string): Bucket => ({
    month,
    invoices: 0,
    onTime: 0,
    late: 0,
    daysLateSum: 0,
    customers: new Set<string>(),
  });
  const buckets = new Map<string, Bucket>();

  for (const inv of inputs.arInvoices) {
    if (!inv.dueDate) continue;
    const month = inv.dueDate.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const settled = inv.status === 'PAID' || inv.paidCents >= inv.totalCents;
    if (!settled) continue;
    const finalOn = lastPayDate.get(inv.id);
    if (!finalOn) continue;
    const b = buckets.get(month) ?? fresh(month);
    b.invoices += 1;
    b.customers.add(canonicalize(inv.customerName));
    if (finalOn <= inv.dueDate) {
      b.onTime += 1;
    } else {
      const days = daysBetween(inv.dueDate, finalOn);
      b.late += 1;
      b.daysLateSum += days;
    }
    buckets.set(month, b);
  }

  const rows: CustomerOnTimeMonthlyRow[] = Array.from(buckets.values())
    .map((b) => {
      const onTimeRate = b.invoices === 0
        ? 0
        : Math.round((b.onTime / b.invoices) * 10_000) / 10_000;
      const avgDaysLate = b.late === 0
        ? 0
        : Math.round((b.daysLateSum / b.late) * 100) / 100;
      return {
        month: b.month,
        invoicesConsidered: b.invoices,
        onTimeCount: b.onTime,
        lateCount: b.late,
        onTimeRate,
        avgDaysLate,
        distinctCustomers: b.customers.size,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month));

  let totalInvoices = 0;
  let totalOnTime = 0;
  for (const r of rows) {
    totalInvoices += r.invoicesConsidered;
    totalOnTime += r.onTimeCount;
  }
  const portfolioRate = totalInvoices === 0
    ? 0
    : Math.round((totalOnTime / totalInvoices) * 10_000) / 10_000;

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalInvoices,
      portfolioOnTimeRate: portfolioRate,
    },
    rows,
  };
}

function canonicalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,'"`]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(llc|inc|incorporated|corp|corporation|co|company|ltd|limited|department|dept|of)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = Date.parse(fromYmd + 'T00:00:00Z');
  const b = Date.parse(toYmd + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}
