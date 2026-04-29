// Per (customer, month) dispatch activity rollup.
//
// Plain English: join dispatches to customers via Job →
// ownerAgency, then bucket by (customerName, yyyy-mm of
// scheduledFor). Counts dispatches, status mix
// (DRAFT / POSTED / COMPLETED / CANCELLED), distinct foremen,
// distinct jobs. Tells YGE the field-throughput per agency
// month over month.
//
// Per row: customerName, month, total, posted, completed,
// cancelled, draft, distinctForemen, distinctJobs.
//
// Sort: customerName asc, month asc.
//
// Different from dispatch-by-month-by-status (portfolio per
// month per status), dispatch-by-job-monthly (per job).
//
// Pure derivation. No persisted records.

import type { Dispatch, DispatchStatus } from './dispatch';
import type { Job } from './job';

export interface CustomerDispatchMonthlyRow {
  customerName: string;
  month: string;
  total: number;
  draft: number;
  posted: number;
  completed: number;
  cancelled: number;
  distinctForemen: number;
  distinctJobs: number;
}

export interface CustomerDispatchMonthlyRollup {
  customersConsidered: number;
  monthsConsidered: number;
  totalDispatches: number;
  unattributed: number;
}

export interface CustomerDispatchMonthlyInputs {
  dispatches: Dispatch[];
  jobs: Job[];
  /** Optional yyyy-mm bounds inclusive applied to scheduledFor. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildCustomerDispatchMonthly(
  inputs: CustomerDispatchMonthlyInputs,
): {
  rollup: CustomerDispatchMonthlyRollup;
  rows: CustomerDispatchMonthlyRow[];
} {
  const jobCustomer = new Map<string, string | undefined>();
  for (const j of inputs.jobs) {
    jobCustomer.set(j.id, j.ownerAgency);
  }

  type Acc = {
    customerName: string;
    month: string;
    total: number;
    byStatus: Record<DispatchStatus, number>;
    foremen: Set<string>;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const customers = new Set<string>();
  const months = new Set<string>();

  let totalDispatches = 0;
  let unattributed = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const d of inputs.dispatches) {
    const month = d.scheduledFor.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    const customerName = jobCustomer.get(d.jobId);
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
        byStatus: { DRAFT: 0, POSTED: 0, COMPLETED: 0, CANCELLED: 0 },
        foremen: new Set(),
        jobs: new Set(),
      };
      accs.set(key, a);
    }
    a.total += 1;
    const st: DispatchStatus = d.status ?? 'DRAFT';
    a.byStatus[st] += 1;
    if (d.foremanName) a.foremen.add(d.foremanName);
    a.jobs.add(d.jobId);

    customers.add(cKey);
    months.add(month);
    totalDispatches += 1;
  }

  const rows: CustomerDispatchMonthlyRow[] = [...accs.values()]
    .map((a) => ({
      customerName: a.customerName,
      month: a.month,
      total: a.total,
      draft: a.byStatus.DRAFT,
      posted: a.byStatus.POSTED,
      completed: a.byStatus.COMPLETED,
      cancelled: a.byStatus.CANCELLED,
      distinctForemen: a.foremen.size,
      distinctJobs: a.jobs.size,
    }))
    .sort((x, y) => {
      const cn = x.customerName.localeCompare(y.customerName);
      if (cn !== 0) return cn;
      return x.month.localeCompare(y.month);
    });

  return {
    rollup: {
      customersConsidered: customers.size,
      monthsConsidered: months.size,
      totalDispatches,
      unattributed,
    },
    rows,
  };
}
