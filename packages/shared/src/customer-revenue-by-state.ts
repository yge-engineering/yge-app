// Per-state customer AR revenue rollup.
//
// Plain English: join AR invoices to Customer records by
// canonical legalName, then bucket totals by Customer.state.
// Heavy civil revenue is mostly in-state, but cross-state
// agencies and private owners do show up. Tracks geographic
// revenue concentration — useful for out-of-state licensing
// review and the bonded-capacity decision.
//
// Per row: state, totalCents, invoiceCount, distinctCustomers,
// distinctJobs.
//
// Sort: totalCents desc.
//
// Different from customer-by-state (count snapshot, no revenue),
// customer-concentration (per-customer dollar share),
// vendor-by-state (AP side).
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';
import type { Customer } from './customer';

export interface CustomerRevenueByStateRow {
  state: string;
  totalCents: number;
  invoiceCount: number;
  distinctCustomers: number;
  distinctJobs: number;
}

export interface CustomerRevenueByStateRollup {
  statesConsidered: number;
  totalInvoices: number;
  totalCents: number;
  unattributed: number;
}

export interface CustomerRevenueByStateInputs {
  customers: Customer[];
  arInvoices: ArInvoice[];
  /** Optional yyyy-mm-dd window applied to invoiceDate. */
  fromDate?: string;
  toDate?: string;
}

function normName(s: string): string {
  return s.toLowerCase().trim();
}

export function buildCustomerRevenueByState(
  inputs: CustomerRevenueByStateInputs,
): {
  rollup: CustomerRevenueByStateRollup;
  rows: CustomerRevenueByStateRow[];
} {
  // Index customer state by canonical name (legalName + dbaName).
  const stateByName = new Map<string, string>();
  for (const c of inputs.customers) {
    if (!c.state) continue;
    stateByName.set(normName(c.legalName), c.state);
    if (c.dbaName) stateByName.set(normName(c.dbaName), c.state);
  }

  type Acc = {
    state: string;
    totalCents: number;
    invoiceCount: number;
    customers: Set<string>;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();
  let totalInvoices = 0;
  let totalCents = 0;
  let unattributed = 0;

  const fromD = inputs.fromDate;
  const toD = inputs.toDate;

  for (const inv of inputs.arInvoices) {
    if (fromD && inv.invoiceDate < fromD) continue;
    if (toD && inv.invoiceDate > toD) continue;

    const state = stateByName.get(normName(inv.customerName));
    if (!state) {
      unattributed += 1;
      continue;
    }
    let a = accs.get(state);
    if (!a) {
      a = {
        state,
        totalCents: 0,
        invoiceCount: 0,
        customers: new Set(),
        jobs: new Set(),
      };
      accs.set(state, a);
    }
    a.totalCents += inv.totalCents ?? 0;
    a.invoiceCount += 1;
    a.customers.add(normName(inv.customerName));
    a.jobs.add(inv.jobId);

    totalInvoices += 1;
    totalCents += inv.totalCents ?? 0;
  }

  const rows: CustomerRevenueByStateRow[] = [...accs.values()]
    .map((a) => ({
      state: a.state,
      totalCents: a.totalCents,
      invoiceCount: a.invoiceCount,
      distinctCustomers: a.customers.size,
      distinctJobs: a.jobs.size,
    }))
    .sort((x, y) => y.totalCents - x.totalCents);

  return {
    rollup: {
      statesConsidered: rows.length,
      totalInvoices,
      totalCents,
      unattributed,
    },
    rows,
  };
}
