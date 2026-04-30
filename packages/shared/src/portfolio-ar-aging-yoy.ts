// Portfolio AR aging year-over-year (year-end snapshot).
//
// Plain English: take a year-end (Dec 31) snapshot of open AR
// for prior + current year and bucket by age (current / 1-30 /
// 31-60 / 61-90 / 90+). Sized for the year-end balance sheet
// AR aging note.
//
// "asOf" defaults to Dec 31 of the requested year.
//
// Different from portfolio-ar-aging-monthly (per month).
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';

export interface PortfolioArAgingYoyBucket {
  openCents: number;
  currentCents: number;
  days1to30Cents: number;
  days31to60Cents: number;
  days61to90Cents: number;
  days90PlusCents: number;
  invoiceCount: number;
}

export interface PortfolioArAgingYoyResult {
  priorYear: number;
  currentYear: number;
  prior: PortfolioArAgingYoyBucket;
  current: PortfolioArAgingYoyBucket;
  openCentsDelta: number;
}

export interface PortfolioArAgingYoyInputs {
  arInvoices: ArInvoice[];
  arPayments: ArPayment[];
  currentYear: number;
}

const MS_PER_DAY = 86_400_000;

function daysBetween(a: string, b: string): number {
  return Math.floor(
    (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / MS_PER_DAY,
  );
}

function snapshot(
  invoices: ArInvoice[],
  payments: ArPayment[],
  asOf: string,
): PortfolioArAgingYoyBucket {
  let openCents = 0;
  let currentCents = 0;
  let d1to30 = 0;
  let d31to60 = 0;
  let d61to90 = 0;
  let d90Plus = 0;
  let invoiceCount = 0;

  function paidByInvoiceBeforeDate(invoiceId: string): number {
    let total = 0;
    for (const p of payments) {
      if (p.arInvoiceId !== invoiceId) continue;
      if (p.receivedOn > asOf) continue;
      total += p.amountCents;
    }
    return total;
  }

  for (const inv of invoices) {
    if (inv.invoiceDate > asOf) continue;
    const paidAsOf = paidByInvoiceBeforeDate(inv.id);
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

  return {
    openCents,
    currentCents,
    days1to30Cents: d1to30,
    days31to60Cents: d31to60,
    days61to90Cents: d61to90,
    days90PlusCents: d90Plus,
    invoiceCount,
  };
}

export function buildPortfolioArAgingYoy(
  inputs: PortfolioArAgingYoyInputs,
): PortfolioArAgingYoyResult {
  const priorYear = inputs.currentYear - 1;
  const prior = snapshot(inputs.arInvoices, inputs.arPayments, `${priorYear}-12-31`);
  const current = snapshot(inputs.arInvoices, inputs.arPayments, `${inputs.currentYear}-12-31`);
  return {
    priorYear,
    currentYear: inputs.currentYear,
    prior,
    current,
    openCentsDelta: current.openCents - prior.openCents,
  };
}
