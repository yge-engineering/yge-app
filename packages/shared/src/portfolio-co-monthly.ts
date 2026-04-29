// Portfolio change-order activity by month with status mix.
//
// Plain English: per yyyy-mm of proposedAt, count change orders
// proposed, approved, executed, sum amount cents, break down
// by reason. Drives the executive change-order trend chart.
//
// Per row: month, proposedCount, approvedCount, executedCount,
// totalAmountCents, byReason, distinctJobs.
//
// Sort: month asc.
//
// Different from co-origin-monthly (origin axis only),
// co-density (per-job density), customer-co-monthly (per
// customer).
//
// Pure derivation. No persisted records.

import type { ChangeOrder, ChangeOrderReason } from './change-order';

export interface PortfolioCoMonthlyRow {
  month: string;
  proposedCount: number;
  approvedCount: number;
  executedCount: number;
  totalAmountCents: number;
  byReason: Partial<Record<ChangeOrderReason, number>>;
  distinctJobs: number;
}

export interface PortfolioCoMonthlyRollup {
  monthsConsidered: number;
  totalCos: number;
  totalAmountCents: number;
  noProposedAtSkipped: number;
}

export interface PortfolioCoMonthlyInputs {
  changeOrders: ChangeOrder[];
  fromMonth?: string;
  toMonth?: string;
}

function sumAmount(co: ChangeOrder): number {
  let total = 0;
  for (const item of co.lineItems ?? []) total += item.amountCents ?? 0;
  return total;
}

export function buildPortfolioCoMonthly(
  inputs: PortfolioCoMonthlyInputs,
): {
  rollup: PortfolioCoMonthlyRollup;
  rows: PortfolioCoMonthlyRow[];
} {
  type Acc = {
    month: string;
    proposedCount: number;
    approvedCount: number;
    executedCount: number;
    totalAmountCents: number;
    byReason: Map<ChangeOrderReason, number>;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();

  let totalCos = 0;
  let totalAmountCents = 0;
  let noProposedAtSkipped = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const co of inputs.changeOrders) {
    if (!co.proposedAt) {
      noProposedAtSkipped += 1;
      continue;
    }
    const month = co.proposedAt.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    let a = accs.get(month);
    if (!a) {
      a = {
        month,
        proposedCount: 0,
        approvedCount: 0,
        executedCount: 0,
        totalAmountCents: 0,
        byReason: new Map(),
        jobs: new Set(),
      };
      accs.set(month, a);
    }
    a.proposedCount += 1;
    if (co.approvedAt) a.approvedCount += 1;
    if (co.executedAt) a.executedCount += 1;
    const amt = sumAmount(co);
    a.totalAmountCents += amt;
    a.byReason.set(co.reason, (a.byReason.get(co.reason) ?? 0) + 1);
    a.jobs.add(co.jobId);

    totalCos += 1;
    totalAmountCents += amt;
  }

  const rows: PortfolioCoMonthlyRow[] = [...accs.values()]
    .map((a) => {
      const byReason: Partial<Record<ChangeOrderReason, number>> = {};
      for (const [k, v] of a.byReason) byReason[k] = v;
      return {
        month: a.month,
        proposedCount: a.proposedCount,
        approvedCount: a.approvedCount,
        executedCount: a.executedCount,
        totalAmountCents: a.totalAmountCents,
        byReason,
        distinctJobs: a.jobs.size,
      };
    })
    .sort((x, y) => x.month.localeCompare(y.month));

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalCos,
      totalAmountCents,
      noProposedAtSkipped,
    },
    rows,
  };
}
