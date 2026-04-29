// Customer revenue year-over-year.
//
// Plain English: roll AR invoices up by (customerName, year)
// for the YoY revenue chart. Drives lender-presentation +
// budget-planning conversations.
//
// Per row: customerName, year, totalCents, invoiceCount,
// distinctJobs, yoyChangeCents (this year minus prior year for
// the same customer), yoyChangePct.
//
// Sort: customerName asc, year asc.
//
// Different from customer-revenue-by-month (per month),
// customer-lifetime (lifetime aggregate), customer-month-matrix
// (month grid).
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';

export interface CustomerRevenueTrendYoyRow {
  customerName: string;
  year: number;
  totalCents: number;
  invoiceCount: number;
  distinctJobs: number;
  yoyChangeCents: number;
  yoyChangePct: number;
}

export interface CustomerRevenueTrendYoyRollup {
  customersConsidered: number;
  yearsConsidered: number;
  totalCents: number;
}

export interface CustomerRevenueTrendYoyInputs {
  arInvoices: ArInvoice[];
  fromYear?: number;
  toYear?: number;
}

export function buildCustomerRevenueTrendYoy(
  inputs: CustomerRevenueTrendYoyInputs,
): {
  rollup: CustomerRevenueTrendYoyRollup;
  rows: CustomerRevenueTrendYoyRow[];
} {
  type Acc = {
    display: string;
    year: number;
    cents: number;
    invoices: number;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const customerSet = new Set<string>();
  const yearSet = new Set<number>();
  let totalCents = 0;

  for (const inv of inputs.arInvoices) {
    const yearStr = inv.invoiceDate.slice(0, 4);
    const year = Number(yearStr);
    if (!Number.isFinite(year)) continue;
    if (inputs.fromYear && year < inputs.fromYear) continue;
    if (inputs.toYear && year > inputs.toYear) continue;
    const canonical = canonicalize(inv.customerName);
    const key = `${canonical}|${year}`;
    const acc = accs.get(key) ?? {
      display: inv.customerName,
      year,
      cents: 0,
      invoices: 0,
      jobs: new Set<string>(),
    };
    acc.cents += inv.totalCents;
    acc.invoices += 1;
    acc.jobs.add(inv.jobId);
    accs.set(key, acc);
    customerSet.add(canonical);
    yearSet.add(year);
    totalCents += inv.totalCents;
  }

  // Pre-index prior-year cents by canonical|year to compute YoY.
  const prior = new Map<string, number>();
  for (const acc of accs.values()) {
    const canonical = canonicalize(acc.display);
    prior.set(`${canonical}|${acc.year}`, acc.cents);
  }

  const rows: CustomerRevenueTrendYoyRow[] = [];
  for (const acc of accs.values()) {
    const canonical = canonicalize(acc.display);
    const priorCents = prior.get(`${canonical}|${acc.year - 1}`) ?? 0;
    const change = acc.cents - priorCents;
    const pct = priorCents === 0
      ? 0
      : Math.round((change / priorCents) * 10_000) / 10_000;
    rows.push({
      customerName: acc.display,
      year: acc.year,
      totalCents: acc.cents,
      invoiceCount: acc.invoices,
      distinctJobs: acc.jobs.size,
      yoyChangeCents: change,
      yoyChangePct: pct,
    });
  }

  rows.sort((a, b) => {
    if (a.customerName !== b.customerName) return a.customerName.localeCompare(b.customerName);
    return a.year - b.year;
  });

  return {
    rollup: {
      customersConsidered: customerSet.size,
      yearsConsidered: yearSet.size,
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
