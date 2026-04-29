// Vendor spend year-over-year.
//
// Plain English: roll AP invoices up by (canonicalized vendor,
// year) for the vendor concentration trend chart. Drives "are we
// becoming more dependent on one supplier" risk visualization.
//
// Per row: vendorName, year, totalCents, invoiceCount,
// yoyChangeCents, yoyChangePct.
//
// Sort: vendorName asc, year asc.
//
// Different from vendor-spend-monthly (per month, no YoY math),
// vendor-lifetime, vendor-concentration.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';

export interface VendorSpendYoyRow {
  vendorName: string;
  year: number;
  totalCents: number;
  invoiceCount: number;
  yoyChangeCents: number;
  yoyChangePct: number;
}

export interface VendorSpendYoyRollup {
  vendorsConsidered: number;
  yearsConsidered: number;
  totalCents: number;
}

export interface VendorSpendYoyInputs {
  apInvoices: ApInvoice[];
  fromYear?: number;
  toYear?: number;
}

export function buildVendorSpendYoy(
  inputs: VendorSpendYoyInputs,
): {
  rollup: VendorSpendYoyRollup;
  rows: VendorSpendYoyRow[];
} {
  type Acc = {
    display: string;
    year: number;
    cents: number;
    invoices: number;
  };
  const accs = new Map<string, Acc>();
  const vendorSet = new Set<string>();
  const yearSet = new Set<number>();
  let totalCents = 0;

  for (const inv of inputs.apInvoices) {
    const yearStr = inv.invoiceDate.slice(0, 4);
    const year = Number(yearStr);
    if (!Number.isFinite(year)) continue;
    if (inputs.fromYear && year < inputs.fromYear) continue;
    if (inputs.toYear && year > inputs.toYear) continue;
    const canonical = canonicalize(inv.vendorName);
    const key = `${canonical}|${year}`;
    const acc = accs.get(key) ?? {
      display: inv.vendorName,
      year,
      cents: 0,
      invoices: 0,
    };
    acc.cents += inv.totalCents;
    acc.invoices += 1;
    accs.set(key, acc);
    vendorSet.add(canonical);
    yearSet.add(year);
    totalCents += inv.totalCents;
  }

  const prior = new Map<string, number>();
  for (const acc of accs.values()) {
    const canonical = canonicalize(acc.display);
    prior.set(`${canonical}|${acc.year}`, acc.cents);
  }

  const rows: VendorSpendYoyRow[] = [];
  for (const acc of accs.values()) {
    const canonical = canonicalize(acc.display);
    const priorCents = prior.get(`${canonical}|${acc.year - 1}`) ?? 0;
    const change = acc.cents - priorCents;
    const pct = priorCents === 0
      ? 0
      : Math.round((change / priorCents) * 10_000) / 10_000;
    rows.push({
      vendorName: acc.display,
      year: acc.year,
      totalCents: acc.cents,
      invoiceCount: acc.invoices,
      yoyChangeCents: change,
      yoyChangePct: pct,
    });
  }

  rows.sort((a, b) => {
    if (a.vendorName !== b.vendorName) return a.vendorName.localeCompare(b.vendorName);
    return a.year - b.year;
  });

  return {
    rollup: {
      vendorsConsidered: vendorSet.size,
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
    .replace(/\b(llc|inc|incorporated|corp|corporation|co|company|ltd|limited)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
