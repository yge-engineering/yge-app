// Per (customer, source, month) AR billing.
//
// Plain English: bucket AR invoices by (customer, source, month).
// Most cuts of this data already exist in pieces — this is the
// three-axis grain so a query like "Caltrans D2 PROGRESS billings
// by month" pivots cleanly out of one table.
//
// Per row: customerName, source, month, totalCents, invoiceCount,
// distinctJobs.
//
// Sort: customerName asc, source asc, month asc.
//
// Different from customer-revenue-by-source (no month axis),
// customer-revenue-by-month (no source axis), ar-monthly-volume
// (portfolio).
//
// Pure derivation. No persisted records.

import type { ArInvoice, ArInvoiceSource } from './ar-invoice';

export interface CustomerBillingBySourceMonthlyRow {
  customerName: string;
  source: ArInvoiceSource;
  month: string;
  totalCents: number;
  invoiceCount: number;
  distinctJobs: number;
}

export interface CustomerBillingBySourceMonthlyRollup {
  customersConsidered: number;
  sourcesConsidered: number;
  monthsConsidered: number;
  totalCents: number;
}

export interface CustomerBillingBySourceMonthlyInputs {
  arInvoices: ArInvoice[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildCustomerBillingBySourceMonthly(
  inputs: CustomerBillingBySourceMonthlyInputs,
): {
  rollup: CustomerBillingBySourceMonthlyRollup;
  rows: CustomerBillingBySourceMonthlyRow[];
} {
  type Acc = {
    display: string;
    source: ArInvoiceSource;
    month: string;
    cents: number;
    invoices: number;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const customerSet = new Set<string>();
  const sourceSet = new Set<ArInvoiceSource>();
  const monthSet = new Set<string>();
  let totalCents = 0;

  for (const inv of inputs.arInvoices) {
    const month = inv.invoiceDate.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const canonical = canonicalize(inv.customerName);
    const key = `${canonical}|${inv.source}|${month}`;
    const acc = accs.get(key) ?? {
      display: inv.customerName,
      source: inv.source,
      month,
      cents: 0,
      invoices: 0,
      jobs: new Set<string>(),
    };
    acc.cents += inv.totalCents;
    acc.invoices += 1;
    acc.jobs.add(inv.jobId);
    accs.set(key, acc);
    customerSet.add(canonical);
    sourceSet.add(inv.source);
    monthSet.add(month);
    totalCents += inv.totalCents;
  }

  const rows: CustomerBillingBySourceMonthlyRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      customerName: acc.display,
      source: acc.source,
      month: acc.month,
      totalCents: acc.cents,
      invoiceCount: acc.invoices,
      distinctJobs: acc.jobs.size,
    });
  }

  rows.sort((a, b) => {
    if (a.customerName !== b.customerName) return a.customerName.localeCompare(b.customerName);
    if (a.source !== b.source) return a.source.localeCompare(b.source);
    return a.month.localeCompare(b.month);
  });

  return {
    rollup: {
      customersConsidered: customerSet.size,
      sourcesConsidered: sourceSet.size,
      monthsConsidered: monthSet.size,
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
