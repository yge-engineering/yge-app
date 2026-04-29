// Per-customer pipeline by status, by month.
//
// Plain English: bucket Job records by (canonicalized
// ownerAgency, yyyy-mm of createdAt) and break down by status.
// Long-format. Useful for the trended pipeline view per
// customer.
//
// Per row: customerName, month, total, prospect, pursuing,
// bidSubmitted, awarded, lost, noBid, archived.
//
// Sort: customerName asc, month asc.
//
// Different from customer-job-pipeline (per-customer snapshot),
// job-creation-monthly (all customers combined).
//
// Pure derivation. No persisted records.

import type { Job, JobStatus } from './job';

export interface CustomerJobByStatusMonthlyRow {
  customerName: string;
  month: string;
  total: number;
  prospect: number;
  pursuing: number;
  bidSubmitted: number;
  awarded: number;
  lost: number;
  noBid: number;
  archived: number;
}

export interface CustomerJobByStatusMonthlyRollup {
  customersConsidered: number;
  monthsConsidered: number;
  totalJobs: number;
  unattributed: number;
}

export interface CustomerJobByStatusMonthlyInputs {
  jobs: Job[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildCustomerJobByStatusMonthly(
  inputs: CustomerJobByStatusMonthlyInputs,
): {
  rollup: CustomerJobByStatusMonthlyRollup;
  rows: CustomerJobByStatusMonthlyRow[];
} {
  type Acc = {
    display: string;
    month: string;
    counts: Record<JobStatus, number>;
  };
  const accs = new Map<string, Acc>();
  const customerSet = new Set<string>();
  const monthSet = new Set<string>();
  let totalJobs = 0;
  let unattributed = 0;

  for (const j of inputs.jobs) {
    const month = j.createdAt.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    totalJobs += 1;
    const display = (j.ownerAgency ?? '').trim();
    if (!display) {
      unattributed += 1;
      continue;
    }
    const canonical = canonicalize(display);
    const key = `${canonical}|${month}`;
    const acc = accs.get(key) ?? {
      display,
      month,
      counts: {
        PROSPECT: 0,
        PURSUING: 0,
        BID_SUBMITTED: 0,
        AWARDED: 0,
        LOST: 0,
        NO_BID: 0,
        ARCHIVED: 0,
      },
    };
    acc.counts[j.status] += 1;
    accs.set(key, acc);
    customerSet.add(canonical);
    monthSet.add(month);
  }

  const rows: CustomerJobByStatusMonthlyRow[] = [];
  for (const acc of accs.values()) {
    let total = 0;
    for (const v of Object.values(acc.counts)) total += v;
    rows.push({
      customerName: acc.display,
      month: acc.month,
      total,
      prospect: acc.counts.PROSPECT,
      pursuing: acc.counts.PURSUING,
      bidSubmitted: acc.counts.BID_SUBMITTED,
      awarded: acc.counts.AWARDED,
      lost: acc.counts.LOST,
      noBid: acc.counts.NO_BID,
      archived: acc.counts.ARCHIVED,
    });
  }

  rows.sort((a, b) => {
    if (a.customerName !== b.customerName) return a.customerName.localeCompare(b.customerName);
    return a.month.localeCompare(b.month);
  });

  return {
    rollup: {
      customersConsidered: customerSet.size,
      monthsConsidered: monthSet.size,
      totalJobs,
      unattributed,
    },
    rows,
  };
}

function canonicalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,'"`]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(llc|inc|incorporated|corp|corporation|co|company|ltd|limited|department|dept|of)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
