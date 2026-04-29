// Per-customer margin year-over-year.
//
// Plain English: take customer-revenue-vs-cost-monthly's per
// (customer, month) numbers, then collapse two consecutive
// fiscal years into a single per-customer comparison row.
// "Caltrans D2 was 22% margin in 2025, up to 28% in 2026 —
// what changed?"
//
// Per row: customerName, priorBilledCents, priorCostCents,
// priorMarginCents, priorMarginPct, currentBilledCents,
// currentCostCents, currentMarginCents, currentMarginPct,
// marginPctDelta, billedDelta.
//
// Sort: currentBilledCents desc, ties by customerName asc.
//
// Different from customer-revenue-vs-cost-monthly (per
// month), customer-revenue-trend-yoy (revenue only),
// customer-billing-yoy (revenue only). This is the margin
// YoY view.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { ArInvoice } from './ar-invoice';
import type { Customer } from './customer';
import type { Expense } from './expense';
import type { Job } from './job';

export interface CustomerMarginYoyRow {
  customerName: string;
  priorBilledCents: number;
  priorCostCents: number;
  priorMarginCents: number;
  priorMarginPct: number | null;
  currentBilledCents: number;
  currentCostCents: number;
  currentMarginCents: number;
  currentMarginPct: number | null;
  /** currentMarginPct - priorMarginPct. Null if either side is null. */
  marginPctDelta: number | null;
  billedDelta: number;
}

export interface CustomerMarginYoyRollup {
  customersConsidered: number;
  priorYear: number;
  currentYear: number;
  priorBilledCents: number;
  priorCostCents: number;
  priorMarginCents: number;
  currentBilledCents: number;
  currentCostCents: number;
  currentMarginCents: number;
}

export interface CustomerMarginYoyInputs {
  arInvoices: ArInvoice[];
  apInvoices: ApInvoice[];
  expenses: Expense[];
  customers: Customer[];
  jobs: Job[];
  /** The current (later) year, e.g. 2026. Prior year is currentYear-1. */
  currentYear: number;
}

function normName(s: string): string {
  return s.toLowerCase().trim();
}

export function buildCustomerMarginYoy(
  inputs: CustomerMarginYoyInputs,
): {
  rollup: CustomerMarginYoyRollup;
  rows: CustomerMarginYoyRow[];
} {
  const priorYear = inputs.currentYear - 1;
  const jobCustomer = new Map<string, string | undefined>();
  for (const j of inputs.jobs) {
    jobCustomer.set(j.id, j.ownerAgency);
  }
  const customerByName = new Map<string, string>();
  for (const c of inputs.customers) {
    customerByName.set(normName(c.legalName), c.legalName);
    if (c.dbaName) customerByName.set(normName(c.dbaName), c.legalName);
  }

  type Acc = {
    customerName: string;
    priorBilledCents: number;
    priorCostCents: number;
    currentBilledCents: number;
    currentCostCents: number;
  };
  const accs = new Map<string, Acc>();

  function bump(
    customerName: string,
    year: number,
    field: 'BilledCents' | 'CostCents',
    cents: number,
  ): void {
    if (year !== priorYear && year !== inputs.currentYear) return;
    const cKey = customerName.toLowerCase().trim();
    let a = accs.get(cKey);
    if (!a) {
      a = {
        customerName,
        priorBilledCents: 0,
        priorCostCents: 0,
        currentBilledCents: 0,
        currentCostCents: 0,
      };
      accs.set(cKey, a);
    }
    const prefix = year === priorYear ? 'prior' : 'current';
    const key = `${prefix}${field}` as keyof Acc;
    (a[key] as number) += cents;
  }

  for (const inv of inputs.arInvoices) {
    const year = Number(inv.invoiceDate.slice(0, 4));
    const matched = customerByName.get(normName(inv.customerName));
    const fallback = jobCustomer.get(inv.jobId);
    const customerName = matched ?? fallback ?? inv.customerName;
    if (!customerName) continue;
    bump(customerName, year, 'BilledCents', inv.totalCents ?? 0);
  }
  for (const inv of inputs.apInvoices) {
    const year = Number(inv.invoiceDate.slice(0, 4));
    const customerName = inv.jobId ? jobCustomer.get(inv.jobId) : undefined;
    if (!customerName) continue;
    bump(customerName, year, 'CostCents', inv.totalCents ?? 0);
  }
  for (const e of inputs.expenses) {
    const year = Number(e.receiptDate.slice(0, 4));
    const customerName = e.jobId ? jobCustomer.get(e.jobId) : undefined;
    if (!customerName) continue;
    bump(customerName, year, 'CostCents', e.amountCents);
  }

  let priorBilled = 0;
  let priorCost = 0;
  let currentBilled = 0;
  let currentCost = 0;

  const rows: CustomerMarginYoyRow[] = [...accs.values()]
    .map((a) => {
      const priorMargin = a.priorBilledCents - a.priorCostCents;
      const currentMargin = a.currentBilledCents - a.currentCostCents;
      const priorPct = a.priorBilledCents > 0 ? priorMargin / a.priorBilledCents : null;
      const currentPct = a.currentBilledCents > 0 ? currentMargin / a.currentBilledCents : null;
      const delta = priorPct !== null && currentPct !== null ? currentPct - priorPct : null;

      priorBilled += a.priorBilledCents;
      priorCost += a.priorCostCents;
      currentBilled += a.currentBilledCents;
      currentCost += a.currentCostCents;

      return {
        customerName: a.customerName,
        priorBilledCents: a.priorBilledCents,
        priorCostCents: a.priorCostCents,
        priorMarginCents: priorMargin,
        priorMarginPct: priorPct,
        currentBilledCents: a.currentBilledCents,
        currentCostCents: a.currentCostCents,
        currentMarginCents: currentMargin,
        currentMarginPct: currentPct,
        marginPctDelta: delta,
        billedDelta: a.currentBilledCents - a.priorBilledCents,
      };
    })
    .sort((x, y) => {
      if (y.currentBilledCents !== x.currentBilledCents) {
        return y.currentBilledCents - x.currentBilledCents;
      }
      return x.customerName.localeCompare(y.customerName);
    });

  return {
    rollup: {
      customersConsidered: rows.length,
      priorYear,
      currentYear: inputs.currentYear,
      priorBilledCents: priorBilled,
      priorCostCents: priorCost,
      priorMarginCents: priorBilled - priorCost,
      currentBilledCents: currentBilled,
      currentCostCents: currentCost,
      currentMarginCents: currentBilled - currentCost,
    },
    rows,
  };
}
