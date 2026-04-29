// Portfolio AR aging snapshot by month-end.
//
// Plain English: walk every month-end in the window, freeze
// "open AR" as of that date (totalCents - paidCents) for AR
// invoices already issued, and split into aging buckets
// (current, 1-30, 31-60, 61-90, 90+). Drives the AR aging
// trend chart and the lender's "show me how the AR ledger
// looks each month-end" page.
//
// "asOfMonthEnd" = last day of the month. An invoice counts
// only if invoiceDate <= asOfMonthEnd. Aging is days from
// invoiceDate to asOfMonthEnd; paid amount as of that month is
// approximated by paidCents - paymentsAfterAsOf, where
// paymentsAfterAsOf comes from arPayments with receivedOn >
// asOfMonthEnd.
//
// Per row: month, openCents, currentCents, days1to30Cents,
// days31to60Cents, days61to90Cents, days90PlusCents,
// invoiceCount.
//
// Sort: month asc.
//
// Different from customer-ar-aging (per-customer snapshot,
// no time axis), customer-ar-aging-summary (overall snapshot),
// ar-aging-by-job (per-job snapshot), aging (per-invoice
// snapshot).
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';

export interface PortfolioArAgingMonthlyRow {
  month: string;
  openCents: number;
  currentCents: number;
  days1to30Cents: number;
  days31to60Cents: number;
  days61to90Cents: number;
  days90PlusCents: number;
  invoiceCount: number;
}

export interface PortfolioArAgingMonthlyRollup {
  monthsConsidered: number;
}

export interface PortfolioArAgingMonthlyInputs {
  arInvoices: ArInvoice[];
  arPayments: ArPayment[];
  /** yyyy-mm of first month-end snapshot. Required. */
  fromMonth: string;
  /** yyyy-mm of last month-end snapshot. Required. */
  toMonth: string;
}

const MS_PER_DAY = 86_400_000;

function lastDayOfMonth(yyyymm: string): string {
  const [yStr, mStr] = yyyymm.split('-');
  const y = Number(yStr ?? '0');
  const m = Number(mStr ?? '0');
  const d = new Date(Date.UTC(y, m, 0));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function daysBetween(a: string, b: string): number {
  return Math.floor(
    (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / MS_PER_DAY,
  );
}

function nextYyyymm(yyyymm: string): string {
  const [yStr, mStr] = yyyymm.split('-');
  let y = Number(yStr ?? '0');
  let m = Number(mStr ?? '0');
  m += 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function buildPortfolioArAgingMonthly(
  inputs: PortfolioArAgingMonthlyInputs,
): {
  rollup: PortfolioArAgingMonthlyRollup;
  rows: PortfolioArAgingMonthlyRow[];
} {
  // Per-invoice payments index for "what was paid before snapshot date".
  const paidByInvoiceBeforeDate = (invoiceId: string, asOf: string): number => {
    let total = 0;
    for (const p of inputs.arPayments) {
      if (p.arInvoiceId !== invoiceId) continue;
      if (p.receivedOn > asOf) continue;
      total += p.amountCents;
    }
    return total;
  };

  const rows: PortfolioArAgingMonthlyRow[] = [];
  let cur = inputs.fromMonth;
  while (cur <= inputs.toMonth) {
    const asOf = lastDayOfMonth(cur);
    let openCents = 0;
    let currentCents = 0;
    let d1to30 = 0;
    let d31to60 = 0;
    let d61to90 = 0;
    let d90Plus = 0;
    let invoiceCount = 0;

    for (const inv of inputs.arInvoices) {
      if (inv.invoiceDate > asOf) continue;
      const paidAsOf = paidByInvoiceBeforeDate(inv.id, asOf);
      const open = (inv.totalCents ?? 0) - paidAsOf;
      if (open <= 0) continue;
      const age = daysBetween(inv.invoiceDate, asOf);
      openCents += open;
      invoiceCount += 1;
      if (age <= 0) currentCents += open;
      else if (age <= 30) d1to30 += open;
      else if (age <= 60) d31to60 += open;
      else if (age <= 90) d61to90 += open;
      else d90Plus += open;
    }

    rows.push({
      month: cur,
      openCents,
      currentCents,
      days1to30Cents: d1to30,
      days31to60Cents: d31to60,
      days61to90Cents: d61to90,
      days90PlusCents: d90Plus,
      invoiceCount,
    });
    cur = nextYyyymm(cur);
  }

  return {
    rollup: { monthsConsidered: rows.length },
    rows,
  };
}
