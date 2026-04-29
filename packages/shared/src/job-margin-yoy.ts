// Per-job margin year-over-year.
//
// Plain English: per-job version of customer-margin-yoy.
// Compares two consecutive years' AR billed, AP cost, and
// expense cost on each job, then surfaces marginCents,
// marginPct, and the deltas. Useful when a multi-year project
// drifts — "Sulphur Springs was 18% in 2025, dropped to 9% in
// 2026 — what blew up?"
//
// Per row: jobId, priorBilledCents, priorCostCents,
// priorMarginCents, priorMarginPct, currentBilledCents,
// currentCostCents, currentMarginCents, currentMarginPct,
// marginPctDelta, billedDelta.
//
// Sort: currentBilledCents desc, ties by jobId asc.
//
// Different from job-revenue-vs-cost-monthly (per month),
// customer-margin-yoy (per customer).
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { ArInvoice } from './ar-invoice';
import type { Expense } from './expense';

export interface JobMarginYoyRow {
  jobId: string;
  priorBilledCents: number;
  priorCostCents: number;
  priorMarginCents: number;
  priorMarginPct: number | null;
  currentBilledCents: number;
  currentCostCents: number;
  currentMarginCents: number;
  currentMarginPct: number | null;
  marginPctDelta: number | null;
  billedDelta: number;
}

export interface JobMarginYoyRollup {
  jobsConsidered: number;
  priorYear: number;
  currentYear: number;
  priorBilledCents: number;
  priorCostCents: number;
  priorMarginCents: number;
  currentBilledCents: number;
  currentCostCents: number;
  currentMarginCents: number;
}

export interface JobMarginYoyInputs {
  arInvoices: ArInvoice[];
  apInvoices: ApInvoice[];
  expenses: Expense[];
  /** The current (later) year, e.g. 2026. Prior year is currentYear-1. */
  currentYear: number;
}

export function buildJobMarginYoy(inputs: JobMarginYoyInputs): {
  rollup: JobMarginYoyRollup;
  rows: JobMarginYoyRow[];
} {
  const priorYear = inputs.currentYear - 1;

  type Acc = {
    jobId: string;
    priorBilledCents: number;
    priorCostCents: number;
    currentBilledCents: number;
    currentCostCents: number;
  };
  const accs = new Map<string, Acc>();

  function bump(
    jobId: string,
    year: number,
    field: 'BilledCents' | 'CostCents',
    cents: number,
  ): void {
    if (year !== priorYear && year !== inputs.currentYear) return;
    let a = accs.get(jobId);
    if (!a) {
      a = {
        jobId,
        priorBilledCents: 0,
        priorCostCents: 0,
        currentBilledCents: 0,
        currentCostCents: 0,
      };
      accs.set(jobId, a);
    }
    const prefix = year === priorYear ? 'prior' : 'current';
    const key = `${prefix}${field}` as keyof Acc;
    (a[key] as number) += cents;
  }

  for (const inv of inputs.arInvoices) {
    bump(inv.jobId, Number(inv.invoiceDate.slice(0, 4)), 'BilledCents', inv.totalCents ?? 0);
  }
  for (const inv of inputs.apInvoices) {
    if (!inv.jobId) continue;
    bump(inv.jobId, Number(inv.invoiceDate.slice(0, 4)), 'CostCents', inv.totalCents ?? 0);
  }
  for (const e of inputs.expenses) {
    if (!e.jobId) continue;
    bump(e.jobId, Number(e.receiptDate.slice(0, 4)), 'CostCents', e.amountCents);
  }

  let priorBilled = 0;
  let priorCost = 0;
  let currentBilled = 0;
  let currentCost = 0;

  const rows: JobMarginYoyRow[] = [...accs.values()]
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
        jobId: a.jobId,
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
      return x.jobId.localeCompare(y.jobId);
    });

  return {
    rollup: {
      jobsConsidered: rows.length,
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
