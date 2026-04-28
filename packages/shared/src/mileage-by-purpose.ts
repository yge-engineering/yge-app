// Mileage by trip purpose.
//
// Plain English: roll the mileage log up by MileagePurpose
// (JOBSITE_TRAVEL, INTER_JOBSITE, BID_WALK, AGENCY_MEETING,
// SUPPLY_RUN, EQUIPMENT_TRANSPORT, OFFICE_ERRAND, TRAINING,
// OTHER). The mix tells which work activities are eating the
// most windshield time — and which deserve to be cost-coded
// directly into a job rather than spread as overhead.
//
// Per row: purpose, count, totalMiles, reimbursementCents,
// distinctEmployees, distinctJobs, share (of total miles).
//
// Sort by totalMiles desc.
//
// Different from employee-mileage-rollup (per-employee
// reimbursement), employee-mileage-monthly (per-employee per
// month). This is the purpose breakdown.
//
// Pure derivation. No persisted records.

import type { MileageEntry, MileagePurpose } from './mileage';

export interface MileageByPurposeRow {
  purpose: MileagePurpose;
  count: number;
  totalMiles: number;
  reimbursementCents: number;
  distinctEmployees: number;
  distinctJobs: number;
  share: number;
}

export interface MileageByPurposeRollup {
  purposesConsidered: number;
  totalCount: number;
  totalMiles: number;
  reimbursementCents: number;
}

export interface MileageByPurposeInputs {
  mileageEntries: MileageEntry[];
  /** Optional yyyy-mm-dd window applied to tripDate. */
  fromDate?: string;
  toDate?: string;
}

export function buildMileageByPurpose(
  inputs: MileageByPurposeInputs,
): {
  rollup: MileageByPurposeRollup;
  rows: MileageByPurposeRow[];
} {
  type Acc = {
    count: number;
    miles: number;
    reimbursement: number;
    employees: Set<string>;
    jobs: Set<string>;
  };
  const accs = new Map<MileagePurpose, Acc>();
  let portfolioCount = 0;
  let portfolioMiles = 0;
  let portfolioReimb = 0;

  for (const m of inputs.mileageEntries) {
    if (inputs.fromDate && m.tripDate < inputs.fromDate) continue;
    if (inputs.toDate && m.tripDate > inputs.toDate) continue;
    const reimb = m.isPersonalVehicle && m.irsRateCentsPerMile
      ? Math.round(m.businessMiles * m.irsRateCentsPerMile)
      : 0;
    portfolioCount += 1;
    portfolioMiles += m.businessMiles;
    portfolioReimb += reimb;
    const acc = accs.get(m.purpose) ?? {
      count: 0,
      miles: 0,
      reimbursement: 0,
      employees: new Set<string>(),
      jobs: new Set<string>(),
    };
    acc.count += 1;
    acc.miles += m.businessMiles;
    acc.reimbursement += reimb;
    acc.employees.add(m.employeeId);
    if (m.jobId) acc.jobs.add(m.jobId);
    accs.set(m.purpose, acc);
  }

  const rows: MileageByPurposeRow[] = [];
  for (const [purpose, acc] of accs.entries()) {
    const share = portfolioMiles === 0
      ? 0
      : Math.round((acc.miles / portfolioMiles) * 10_000) / 10_000;
    rows.push({
      purpose,
      count: acc.count,
      totalMiles: Math.round(acc.miles * 100) / 100,
      reimbursementCents: acc.reimbursement,
      distinctEmployees: acc.employees.size,
      distinctJobs: acc.jobs.size,
      share,
    });
  }

  rows.sort((a, b) => b.totalMiles - a.totalMiles);

  return {
    rollup: {
      purposesConsidered: rows.length,
      totalCount: portfolioCount,
      totalMiles: Math.round(portfolioMiles * 100) / 100,
      reimbursementCents: portfolioReimb,
    },
    rows,
  };
}
