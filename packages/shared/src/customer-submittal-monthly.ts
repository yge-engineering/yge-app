// Per (customer, month) submittal activity.
//
// Plain English: join submittals to customers via Job →
// ownerAgency, then bucket by (customerName, yyyy-mm of
// submittedAt). Counts submitted, approved (APPROVED +
// APPROVED_AS_NOTED), revise/resubmit, rejected, and
// blocksOrdering. Surfaces "which agency reviewer is the
// bottleneck on submittals" patterns.
//
// Per row: customerName, month, totalSubmitted, approvedCount,
// reviseResubmitCount, rejectedCount, blockedOrderingCount,
// distinctJobs.
//
// Sort: customerName asc, month asc.
//
// Different from submittal-monthly-volume (portfolio per
// month), submittal-by-author-monthly (per author per month),
// job-submittal-pipeline (per job snapshot).
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { Submittal } from './submittal';

export interface CustomerSubmittalMonthlyRow {
  customerName: string;
  month: string;
  totalSubmitted: number;
  approvedCount: number;
  reviseResubmitCount: number;
  rejectedCount: number;
  blockedOrderingCount: number;
  distinctJobs: number;
}

export interface CustomerSubmittalMonthlyRollup {
  customersConsidered: number;
  monthsConsidered: number;
  totalSubmittals: number;
  noSubmittedAtSkipped: number;
  unattributed: number;
}

export interface CustomerSubmittalMonthlyInputs {
  submittals: Submittal[];
  jobs: Job[];
  /** Optional yyyy-mm bounds inclusive applied to submittedAt. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildCustomerSubmittalMonthly(
  inputs: CustomerSubmittalMonthlyInputs,
): {
  rollup: CustomerSubmittalMonthlyRollup;
  rows: CustomerSubmittalMonthlyRow[];
} {
  const jobCustomer = new Map<string, string | undefined>();
  for (const j of inputs.jobs) {
    jobCustomer.set(j.id, j.ownerAgency);
  }

  type Acc = {
    customerName: string;
    month: string;
    totalSubmitted: number;
    approvedCount: number;
    reviseResubmitCount: number;
    rejectedCount: number;
    blockedOrderingCount: number;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const customers = new Set<string>();
  const months = new Set<string>();

  let totalSubmittals = 0;
  let noSubmittedAtSkipped = 0;
  let unattributed = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const s of inputs.submittals) {
    if (!s.submittedAt) {
      noSubmittedAtSkipped += 1;
      continue;
    }
    const month = s.submittedAt.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    const customerName = jobCustomer.get(s.jobId);
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
        totalSubmitted: 0,
        approvedCount: 0,
        reviseResubmitCount: 0,
        rejectedCount: 0,
        blockedOrderingCount: 0,
        jobs: new Set(),
      };
      accs.set(key, a);
    }
    a.totalSubmitted += 1;
    const status = s.status ?? 'DRAFT';
    if (status === 'APPROVED' || status === 'APPROVED_AS_NOTED') {
      a.approvedCount += 1;
    } else if (status === 'REVISE_RESUBMIT') {
      a.reviseResubmitCount += 1;
    } else if (status === 'REJECTED') {
      a.rejectedCount += 1;
    }
    if (s.blocksOrdering) a.blockedOrderingCount += 1;
    a.jobs.add(s.jobId);

    customers.add(cKey);
    months.add(month);
    totalSubmittals += 1;
  }

  const rows: CustomerSubmittalMonthlyRow[] = [...accs.values()]
    .map((a) => ({
      customerName: a.customerName,
      month: a.month,
      totalSubmitted: a.totalSubmitted,
      approvedCount: a.approvedCount,
      reviseResubmitCount: a.reviseResubmitCount,
      rejectedCount: a.rejectedCount,
      blockedOrderingCount: a.blockedOrderingCount,
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
      totalSubmittals,
      noSubmittedAtSkipped,
      unattributed,
    },
    rows,
  };
}
