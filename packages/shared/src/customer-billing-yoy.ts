// Customer billing year-over-year (portfolio).
//
// Plain English: roll AR invoices up by year for the portfolio
// YoY chart. Drives the "we billed X% more this year than
// last" topline.
//
// Per row: year, totalCents, invoiceCount, distinctCustomers,
// distinctJobs, yoyChangeCents, yoyChangePct.
//
// Sort by year asc.
//
// Different from customer-revenue-trend-yoy (per customer per
// year), customer-revenue-by-month (per month).
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';

export interface CustomerBillingYoyRow {
  year: number;
  totalCents: number;
  invoiceCount: number;
  distinctCustomers: number;
  distinctJobs: number;
  yoyChangeCents: number;
  yoyChangePct: number;
}

export interface CustomerBillingYoyRollup {
  yearsConsidered: number;
  totalCents: number;
}

export interface CustomerBillingYoyInputs {
  arInvoices: ArInvoice[];
  fromYear?: number;
  toYear?: number;
}

export function buildCustomerBillingYoy(
  inputs: CustomerBillingYoyInputs,
): {
  rollup: CustomerBillingYoyRollup;
  rows: CustomerBillingYoyRow[];
} {
  type Acc = {
    year: number;
    cents: number;
    invoices: number;
    customers: Set<string>;
    jobs: Set<string>;
  };
  const accs = new Map<number, Acc>();
  let totalCents = 0;

  for (const inv of inputs.arInvoices) {
    const yearStr = inv.invoiceDate.slice(0, 4);
    const year = Number(yearStr);
    if (!Number.isFinite(year)) continue;
    if (inputs.fromYear && year < inputs.fromYear) continue;
    if (inputs.toYear && year > inputs.toYear) continue;
    const acc = accs.get(year) ?? {
      year,
      cents: 0,
      invoices: 0,
      customers: new Set<string>(),
      jobs: new Set<string>(),
    };
    acc.cents += inv.totalCents;
    acc.invoices += 1;
    acc.customers.add(canonicalize(inv.customerName));
    acc.jobs.add(inv.jobId);
    accs.set(year, acc);
    totalCents += inv.totalCents;
  }

  const sorted = Array.from(accs.values()).sort((a, b) => a.year - b.year);
  const priorByYear = new Map<number, number>();
  for (const acc of sorted) priorByYear.set(acc.year, acc.cents);

  const rows: CustomerBillingYoyRow[] = sorted.map((acc) => {
    const priorCents = priorByYear.get(acc.year - 1) ?? 0;
    const change = acc.cents - priorCents;
    const pct = priorCents === 0
      ? 0
      : Math.round((change / priorCents) * 10_000) / 10_000;
    return {
      year: acc.year,
      totalCents: acc.cents,
      invoiceCount: acc.invoices,
      distinctCustomers: acc.customers.size,
      distinctJobs: acc.jobs.size,
      yoyChangeCents: change,
      yoyChangePct: pct,
    };
  });

  return {
    rollup: {
      yearsConsidered: rows.length,
      totalCents,
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
