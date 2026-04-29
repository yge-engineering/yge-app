// Portfolio potential-change-order activity by month.
//
// Plain English: per yyyy-mm of noticedOn, count PCOs filed,
// open vs converted, sum total + open cost exposure, total
// schedule impact days, distinct jobs. Drives the executive
// "what's lining up to become a CO" view.
//
// Per row: month, total, openCount, convertedCount,
// totalCostImpactCents, openCostImpactCents,
// totalScheduleImpactDays, distinctJobs.
//
// Sort: month asc.
//
// Different from pco-exposure (per-job dollar exposure),
// pco-origin-breakdown (per-origin), customer-pco-monthly
// (per customer).
//
// Pure derivation. No persisted records.

import type { Pco } from './pco';

export interface PortfolioPcoMonthlyRow {
  month: string;
  total: number;
  openCount: number;
  convertedCount: number;
  totalCostImpactCents: number;
  openCostImpactCents: number;
  totalScheduleImpactDays: number;
  distinctJobs: number;
}

export interface PortfolioPcoMonthlyRollup {
  monthsConsidered: number;
  totalPcos: number;
}

export interface PortfolioPcoMonthlyInputs {
  pcos: Pco[];
  fromMonth?: string;
  toMonth?: string;
}

export function buildPortfolioPcoMonthly(
  inputs: PortfolioPcoMonthlyInputs,
): {
  rollup: PortfolioPcoMonthlyRollup;
  rows: PortfolioPcoMonthlyRow[];
} {
  type Acc = {
    month: string;
    total: number;
    openCount: number;
    convertedCount: number;
    totalCostImpactCents: number;
    openCostImpactCents: number;
    totalScheduleImpactDays: number;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();

  let totalPcos = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const p of inputs.pcos) {
    const month = p.noticedOn.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    let a = accs.get(month);
    if (!a) {
      a = {
        month,
        total: 0,
        openCount: 0,
        convertedCount: 0,
        totalCostImpactCents: 0,
        openCostImpactCents: 0,
        totalScheduleImpactDays: 0,
        jobs: new Set(),
      };
      accs.set(month, a);
    }
    a.total += 1;
    const status = p.status ?? 'DRAFT';
    const isConverted = status === 'CONVERTED_TO_CO';
    const isOpen = !isConverted && status !== 'REJECTED';
    if (isConverted) a.convertedCount += 1;
    if (isOpen) a.openCount += 1;
    a.totalCostImpactCents += p.costImpactCents ?? 0;
    if (isOpen && (p.costImpactCents ?? 0) > 0) {
      a.openCostImpactCents += p.costImpactCents ?? 0;
    }
    a.totalScheduleImpactDays += p.scheduleImpactDays ?? 0;
    a.jobs.add(p.jobId);
    totalPcos += 1;
  }

  const rows: PortfolioPcoMonthlyRow[] = [...accs.values()]
    .map((a) => ({
      month: a.month,
      total: a.total,
      openCount: a.openCount,
      convertedCount: a.convertedCount,
      totalCostImpactCents: a.totalCostImpactCents,
      openCostImpactCents: a.openCostImpactCents,
      totalScheduleImpactDays: a.totalScheduleImpactDays,
      distinctJobs: a.jobs.size,
    }))
    .sort((x, y) => x.month.localeCompare(y.month));

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalPcos,
    },
    rows,
  };
}
