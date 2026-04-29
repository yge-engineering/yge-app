// Portfolio AP aging snapshot by month-end.
//
// Plain English: AP-side mirror of portfolio-ar-aging-monthly.
// Walk every month-end in the window, freeze "open AP"
// (totalCents - paidCentsAsOf) for AP invoices already
// received, split into aging buckets (current, 1-30, 31-60,
// 61-90, 90+). Drives the cash plan ("how much do we owe at
// each month-end and how old is it?").
//
// asOfMonthEnd = last day of the month. Invoice counts only
// if invoiceDate <= asOfMonthEnd. paidCentsAsOf comes from
// non-voided AP payments matched to the invoice with paidOn
// <= asOfMonthEnd.
//
// Per row: month, openCents, currentCents, days1to30Cents,
// days31to60Cents, days61to90Cents, days90PlusCents,
// invoiceCount.
//
// Sort: month asc.
//
// Different from ap-aging-summary (point-in-time, no time
// axis), portfolio-ar-aging-monthly (AR side).
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { ApPayment } from './ap-payment';

export interface PortfolioApAgingMonthlyRow {
  month: string;
  openCents: number;
  currentCents: number;
  days1to30Cents: number;
  days31to60Cents: number;
  days61to90Cents: number;
  days90PlusCents: number;
  invoiceCount: number;
}

export interface PortfolioApAgingMonthlyRollup {
  monthsConsidered: number;
}

export interface PortfolioApAgingMonthlyInputs {
  apInvoices: ApInvoice[];
  apPayments: ApPayment[];
  fromMonth: string;
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

export function buildPortfolioApAgingMonthly(
  inputs: PortfolioApAgingMonthlyInputs,
): {
  rollup: PortfolioApAgingMonthlyRollup;
  rows: PortfolioApAgingMonthlyRow[];
} {
  const paidByInvoiceBeforeDate = (invoiceId: string, asOf: string): number => {
    let total = 0;
    for (const p of inputs.apPayments) {
      if (p.voided) continue;
      if (p.apInvoiceId !== invoiceId) continue;
      if (p.paidOn > asOf) continue;
      total += p.amountCents;
    }
    return total;
  };

  const rows: PortfolioApAgingMonthlyRow[] = [];
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

    for (const inv of inputs.apInvoices) {
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
