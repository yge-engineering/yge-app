// Portfolio job creation activity by month.
//
// Plain English: per yyyy-mm of Job.createdAt, count jobs
// created with status mix (PROSPECT / PURSUING / BID_SUBMITTED
// / AWARDED / LOST / NO_BID / ARCHIVED) plus the project type
// mix. Drives the "what's flowing into the pipeline each
// month and how is it landing" view.
//
// Per row: month, total, byStatus, byProjectType, distinctOwners.
//
// Sort: month asc.
//
// Different from job-creation-monthly (count + projectType
// only), bid-pursuit-monthly (uses bidDueDate), portfolio-
// bid-monthly (uses bidDueDate).
//
// Pure derivation. No persisted records.

import type { Job, JobStatus } from './job';
import type { PtoEProjectType } from './plans-to-estimate-output';

export interface PortfolioJobStatusMonthlyRow {
  month: string;
  total: number;
  byStatus: Partial<Record<JobStatus, number>>;
  byProjectType: Partial<Record<PtoEProjectType, number>>;
  distinctOwners: number;
}

export interface PortfolioJobStatusMonthlyRollup {
  monthsConsidered: number;
  totalJobs: number;
}

export interface PortfolioJobStatusMonthlyInputs {
  jobs: Job[];
  fromMonth?: string;
  toMonth?: string;
}

export function buildPortfolioJobStatusMonthly(
  inputs: PortfolioJobStatusMonthlyInputs,
): {
  rollup: PortfolioJobStatusMonthlyRollup;
  rows: PortfolioJobStatusMonthlyRow[];
} {
  type Acc = {
    month: string;
    total: number;
    byStatus: Map<JobStatus, number>;
    byProjectType: Map<PtoEProjectType, number>;
    owners: Set<string>;
  };
  const accs = new Map<string, Acc>();

  let totalJobs = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const j of inputs.jobs) {
    const month = j.createdAt.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    let a = accs.get(month);
    if (!a) {
      a = {
        month,
        total: 0,
        byStatus: new Map(),
        byProjectType: new Map(),
        owners: new Set(),
      };
      accs.set(month, a);
    }
    a.total += 1;
    const status: JobStatus = j.status ?? 'PURSUING';
    a.byStatus.set(status, (a.byStatus.get(status) ?? 0) + 1);
    a.byProjectType.set(j.projectType, (a.byProjectType.get(j.projectType) ?? 0) + 1);
    if (j.ownerAgency) a.owners.add(j.ownerAgency.toLowerCase().trim());
    totalJobs += 1;
  }

  const rows: PortfolioJobStatusMonthlyRow[] = [...accs.values()]
    .map((a) => {
      const byStatus: Partial<Record<JobStatus, number>> = {};
      for (const [k, v] of a.byStatus) byStatus[k] = v;
      const byProjectType: Partial<Record<PtoEProjectType, number>> = {};
      for (const [k, v] of a.byProjectType) byProjectType[k] = v;
      return {
        month: a.month,
        total: a.total,
        byStatus,
        byProjectType,
        distinctOwners: a.owners.size,
      };
    })
    .sort((x, y) => x.month.localeCompare(y.month));

  return {
    rollup: { monthsConsidered: rows.length, totalJobs },
    rows,
  };
}
