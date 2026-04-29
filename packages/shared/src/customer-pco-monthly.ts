// Per (customer, month) potential change order activity.
//
// Plain English: join PCOs to customers via Job → ownerAgency,
// then bucket by (customerName, yyyy-mm of noticedOn). Counts
// PCOs filed, sums cost-impact cents (open vs converted), tracks
// schedule-impact days. PCOs are how YGE puts the agency on
// notice that a CO is coming — early-warning AR.
//
// Per row: customerName, month, total, openCount, convertedCount,
// totalCostImpactCents, openCostImpactCents,
// totalScheduleImpactDays.
//
// Sort: customerName asc, month asc.
//
// Different from pco-exposure (per-job dollar exposure),
// pco-origin-breakdown (per-origin portfolio),
// job-pco-monthly (per-job per-month), customer-co-monthly
// (CO not PCO axis).
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { Pco } from './pco';

export interface CustomerPcoMonthlyRow {
  customerName: string;
  month: string;
  total: number;
  openCount: number;
  convertedCount: number;
  totalCostImpactCents: number;
  openCostImpactCents: number;
  totalScheduleImpactDays: number;
}

export interface CustomerPcoMonthlyRollup {
  customersConsidered: number;
  monthsConsidered: number;
  totalPcos: number;
  unattributed: number;
}

export interface CustomerPcoMonthlyInputs {
  pcos: Pco[];
  jobs: Job[];
  /** Optional yyyy-mm bounds inclusive applied to noticedOn. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildCustomerPcoMonthly(
  inputs: CustomerPcoMonthlyInputs,
): {
  rollup: CustomerPcoMonthlyRollup;
  rows: CustomerPcoMonthlyRow[];
} {
  // Index Job → ownerAgency for the customer-name lookup.
  const jobCustomer = new Map<string, string | undefined>();
  for (const j of inputs.jobs) {
    jobCustomer.set(j.id, j.ownerAgency);
  }

  type Acc = {
    customerName: string;
    month: string;
    total: number;
    openCount: number;
    convertedCount: number;
    totalCostImpactCents: number;
    openCostImpactCents: number;
    totalScheduleImpactDays: number;
  };
  const accs = new Map<string, Acc>();
  const customers = new Set<string>();
  const months = new Set<string>();

  let totalPcos = 0;
  let unattributed = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const p of inputs.pcos) {
    const month = p.noticedOn.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    const customerName = jobCustomer.get(p.jobId);
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
        total: 0,
        openCount: 0,
        convertedCount: 0,
        totalCostImpactCents: 0,
        openCostImpactCents: 0,
        totalScheduleImpactDays: 0,
      };
      accs.set(key, a);
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

    customers.add(cKey);
    months.add(month);
    totalPcos += 1;
  }

  const rows: CustomerPcoMonthlyRow[] = [...accs.values()].sort((x, y) => {
    const cn = x.customerName.localeCompare(y.customerName);
    if (cn !== 0) return cn;
    return x.month.localeCompare(y.month);
  });

  return {
    rollup: {
      customersConsidered: customers.size,
      monthsConsidered: months.size,
      totalPcos,
      unattributed,
    },
    rows,
  };
}
