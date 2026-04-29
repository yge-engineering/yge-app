// Per (customer kind, month) AR revenue rollup.
//
// Plain English: join AR invoices to Customer records by
// canonical legalName / dbaName, then bucket totals by
// CustomerKind (STATE_AGENCY / FEDERAL_AGENCY / COUNTY / CITY
// / SPECIAL_DISTRICT / PRIVATE_OWNER / PRIME_CONTRACTOR /
// OTHER) and yyyy-mm of invoiceDate. Tells YGE the agency-mix
// trend month over month — the "are we drifting away from
// public works into private?" cut.
//
// Per row: kind, month, totalCents, invoiceCount,
// distinctCustomers, distinctJobs.
//
// Sort: month asc, kind asc within month.
//
// Different from customer-by-state (geography), customer-
// revenue-by-month (per-customer, no kind axis), customer-
// revenue-by-source (per-customer, source axis), customer-
// concentration (lifetime $ share).
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';
import type { Customer, CustomerKind } from './customer';

export interface CustomerRevenueByKindMonthlyRow {
  kind: CustomerKind;
  month: string;
  totalCents: number;
  invoiceCount: number;
  distinctCustomers: number;
  distinctJobs: number;
}

export interface CustomerRevenueByKindMonthlyRollup {
  kindsConsidered: number;
  monthsConsidered: number;
  totalInvoices: number;
  totalCents: number;
  unattributed: number;
}

export interface CustomerRevenueByKindMonthlyInputs {
  customers: Customer[];
  arInvoices: ArInvoice[];
  /** Optional yyyy-mm bounds inclusive applied to invoiceDate. */
  fromMonth?: string;
  toMonth?: string;
}

function normName(s: string): string {
  return s.toLowerCase().trim();
}

export function buildCustomerRevenueByKindMonthly(
  inputs: CustomerRevenueByKindMonthlyInputs,
): {
  rollup: CustomerRevenueByKindMonthlyRollup;
  rows: CustomerRevenueByKindMonthlyRow[];
} {
  const kindByName = new Map<string, CustomerKind>();
  for (const c of inputs.customers) {
    kindByName.set(normName(c.legalName), c.kind);
    if (c.dbaName) kindByName.set(normName(c.dbaName), c.kind);
  }

  type Acc = {
    kind: CustomerKind;
    month: string;
    totalCents: number;
    invoiceCount: number;
    customers: Set<string>;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const kinds = new Set<CustomerKind>();
  const months = new Set<string>();

  let totalInvoices = 0;
  let totalCents = 0;
  let unattributed = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const inv of inputs.arInvoices) {
    const month = inv.invoiceDate.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    const kind = kindByName.get(normName(inv.customerName));
    if (!kind) {
      unattributed += 1;
      continue;
    }
    const key = `${kind}__${month}`;
    let a = accs.get(key);
    if (!a) {
      a = {
        kind,
        month,
        totalCents: 0,
        invoiceCount: 0,
        customers: new Set(),
        jobs: new Set(),
      };
      accs.set(key, a);
    }
    a.totalCents += inv.totalCents ?? 0;
    a.invoiceCount += 1;
    a.customers.add(normName(inv.customerName));
    a.jobs.add(inv.jobId);

    kinds.add(kind);
    months.add(month);
    totalInvoices += 1;
    totalCents += inv.totalCents ?? 0;
  }

  const rows: CustomerRevenueByKindMonthlyRow[] = [...accs.values()]
    .map((a) => ({
      kind: a.kind,
      month: a.month,
      totalCents: a.totalCents,
      invoiceCount: a.invoiceCount,
      distinctCustomers: a.customers.size,
      distinctJobs: a.jobs.size,
    }))
    .sort((x, y) => {
      if (x.month !== y.month) return x.month.localeCompare(y.month);
      return x.kind.localeCompare(y.kind);
    });

  return {
    rollup: {
      kindsConsidered: kinds.size,
      monthsConsidered: months.size,
      totalInvoices,
      totalCents,
      unattributed,
    },
    rows,
  };
}
