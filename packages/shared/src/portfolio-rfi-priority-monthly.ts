// Portfolio RFI activity by month with priority + impact mix.
//
// Plain English: per yyyy-mm of sentAt, count RFIs with priority
// breakdown (LOW/MEDIUM/HIGH/CRITICAL), answered count, plus
// cost + schedule impact flags. Different from rfi-monthly-volume
// (timing only) and rfi-priority-monthly (priority only) — this
// is the one-stop priority+impact monthly view.
//
// Per row: month, totalSent, answeredCount, low, medium, high,
// critical, costImpactCount, scheduleImpactCount, distinctJobs.
//
// Sort: month asc.
//
// Pure derivation. No persisted records.

import type { Rfi, RfiPriority } from './rfi';

export interface PortfolioRfiPriorityMonthlyRow {
  month: string;
  totalSent: number;
  answeredCount: number;
  low: number;
  medium: number;
  high: number;
  critical: number;
  costImpactCount: number;
  scheduleImpactCount: number;
  distinctJobs: number;
}

export interface PortfolioRfiPriorityMonthlyRollup {
  monthsConsidered: number;
  totalRfis: number;
  noSentAtSkipped: number;
}

export interface PortfolioRfiPriorityMonthlyInputs {
  rfis: Rfi[];
  fromMonth?: string;
  toMonth?: string;
}

export function buildPortfolioRfiPriorityMonthly(
  inputs: PortfolioRfiPriorityMonthlyInputs,
): {
  rollup: PortfolioRfiPriorityMonthlyRollup;
  rows: PortfolioRfiPriorityMonthlyRow[];
} {
  type Acc = {
    month: string;
    totalSent: number;
    answeredCount: number;
    byPriority: Record<RfiPriority, number>;
    costImpactCount: number;
    scheduleImpactCount: number;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();

  let totalRfis = 0;
  let noSentAtSkipped = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const r of inputs.rfis) {
    if (!r.sentAt) {
      noSentAtSkipped += 1;
      continue;
    }
    const month = r.sentAt.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    let a = accs.get(month);
    if (!a) {
      a = {
        month,
        totalSent: 0,
        answeredCount: 0,
        byPriority: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
        costImpactCount: 0,
        scheduleImpactCount: 0,
        jobs: new Set(),
      };
      accs.set(month, a);
    }
    a.totalSent += 1;
    if (r.answeredAt) a.answeredCount += 1;
    const pri: RfiPriority = r.priority ?? 'MEDIUM';
    a.byPriority[pri] += 1;
    if (r.costImpact) a.costImpactCount += 1;
    if (r.scheduleImpact) a.scheduleImpactCount += 1;
    a.jobs.add(r.jobId);
    totalRfis += 1;
  }

  const rows: PortfolioRfiPriorityMonthlyRow[] = [...accs.values()]
    .map((a) => ({
      month: a.month,
      totalSent: a.totalSent,
      answeredCount: a.answeredCount,
      low: a.byPriority.LOW,
      medium: a.byPriority.MEDIUM,
      high: a.byPriority.HIGH,
      critical: a.byPriority.CRITICAL,
      costImpactCount: a.costImpactCount,
      scheduleImpactCount: a.scheduleImpactCount,
      distinctJobs: a.jobs.size,
    }))
    .sort((x, y) => x.month.localeCompare(y.month));

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalRfis,
      noSentAtSkipped,
    },
    rows,
  };
}
