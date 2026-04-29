// Per (customer, month) RFI activity rollup.
//
// Plain English: join RFIs to customers via Job → ownerAgency,
// then bucket by (customerName, yyyy-mm of sentAt). Counts
// RFIs sent, answered, breaks down by priority, counts cost-
// or schedule-impact flags. Surfaces "Caltrans D2 hit us with
// 14 RFIs in March" patterns — where the engineer is the
// bottleneck.
//
// Per row: customerName, month, totalSent, answeredCount,
// byPriority, costImpactCount, scheduleImpactCount,
// distinctJobs.
//
// Sort: customerName asc, month asc.
//
// Different from rfi-monthly-volume (portfolio per month, no
// customer axis), rfi-by-asker (per asker), customer-co-
// monthly (CO axis), customer-pco-monthly (PCO axis).
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { Rfi, RfiPriority } from './rfi';

export interface CustomerRfiMonthlyRow {
  customerName: string;
  month: string;
  totalSent: number;
  answeredCount: number;
  byPriority: Partial<Record<RfiPriority, number>>;
  costImpactCount: number;
  scheduleImpactCount: number;
  distinctJobs: number;
}

export interface CustomerRfiMonthlyRollup {
  customersConsidered: number;
  monthsConsidered: number;
  totalRfis: number;
  noSentAtSkipped: number;
  unattributed: number;
}

export interface CustomerRfiMonthlyInputs {
  rfis: Rfi[];
  jobs: Job[];
  /** Optional yyyy-mm bounds inclusive applied to sentAt. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildCustomerRfiMonthly(
  inputs: CustomerRfiMonthlyInputs,
): {
  rollup: CustomerRfiMonthlyRollup;
  rows: CustomerRfiMonthlyRow[];
} {
  const jobCustomer = new Map<string, string | undefined>();
  for (const j of inputs.jobs) {
    jobCustomer.set(j.id, j.ownerAgency);
  }

  type Acc = {
    customerName: string;
    month: string;
    totalSent: number;
    answeredCount: number;
    byPriority: Map<RfiPriority, number>;
    costImpactCount: number;
    scheduleImpactCount: number;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const customers = new Set<string>();
  const months = new Set<string>();

  let totalRfis = 0;
  let noSentAtSkipped = 0;
  let unattributed = 0;

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

    const customerName = jobCustomer.get(r.jobId);
    if (!customerName) {
      unattributed += 1;
      continue;
    }
    const cKey = customerName.toLowerCase().trim();
    const key = `${cKey}__${month}`;
    let a = accs.get(key);
    if (!a) {
      a = {
        customerName,
        month,
        totalSent: 0,
        answeredCount: 0,
        byPriority: new Map(),
        costImpactCount: 0,
        scheduleImpactCount: 0,
        jobs: new Set(),
      };
      accs.set(key, a);
    }
    a.totalSent += 1;
    if (r.answeredAt) a.answeredCount += 1;
    const pri: RfiPriority = r.priority ?? 'MEDIUM';
    a.byPriority.set(pri, (a.byPriority.get(pri) ?? 0) + 1);
    if (r.costImpact) a.costImpactCount += 1;
    if (r.scheduleImpact) a.scheduleImpactCount += 1;
    a.jobs.add(r.jobId);

    customers.add(cKey);
    months.add(month);
    totalRfis += 1;
  }

  const rows: CustomerRfiMonthlyRow[] = [...accs.values()]
    .map((a) => {
      const byPriority: Partial<Record<RfiPriority, number>> = {};
      for (const [k, v] of a.byPriority) byPriority[k] = v;
      return {
        customerName: a.customerName,
        month: a.month,
        totalSent: a.totalSent,
        answeredCount: a.answeredCount,
        byPriority,
        costImpactCount: a.costImpactCount,
        scheduleImpactCount: a.scheduleImpactCount,
        distinctJobs: a.jobs.size,
      };
    })
    .sort((x, y) => {
      const cn = x.customerName.localeCompare(y.customerName);
      if (cn !== 0) return cn;
      return x.month.localeCompare(y.month);
    });

  return {
    rollup: {
      customersConsidered: customers.size,
      monthsConsidered: months.size,
      totalRfis,
      noSentAtSkipped,
      unattributed,
    },
    rows,
  };
}
