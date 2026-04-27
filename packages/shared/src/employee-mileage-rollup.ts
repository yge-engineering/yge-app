// Per-employee mileage rollup.
//
// Plain English: when an employee uses their personal vehicle for
// company business — driving to the jobsite, going on a parts run,
// attending an agency meeting — IRS standard-rate reimbursement
// applies. This walks the mileage log, filters to personal-vehicle
// entries (company-vehicle trips don't reimburse), and rolls up:
//   - total miles
//   - reimbursable $ at the rate in effect on each trip
//   - already-reimbursed $ vs. unreimbursed $
//   - mileage by purpose (jobsite travel vs supply run vs etc.)
//
// Drives the expense-reimbursement scoreboard + monthly mileage-
// payout queue.
//
// Pure derivation. No persisted records.

import type { MileageEntry, MileagePurpose } from './mileage';

const PURPOSE_KEYS: MileagePurpose[] = [
  'JOBSITE_TRAVEL',
  'INTER_JOBSITE',
  'BID_WALK',
  'AGENCY_MEETING',
  'SUPPLY_RUN',
  'EQUIPMENT_TRANSPORT',
  'OFFICE_ERRAND',
  'TRAINING',
  'OTHER',
];

export interface EmployeeMileageRow {
  employeeId: string;
  employeeName: string;
  tripCount: number;
  totalMiles: number;
  /** Sum of businessMiles * irsRateCentsPerMile (when set) for
   *  PERSONAL vehicle trips only. */
  reimbursableCents: number;
  reimbursedCents: number;
  unreimbursedCents: number;
  /** Distinct trip dates in the window. */
  distinctDays: number;
  milesByPurpose: Record<MileagePurpose, number>;
}

export interface EmployeeMileageRollup {
  employeesConsidered: number;
  totalMiles: number;
  totalReimbursableCents: number;
  totalReimbursedCents: number;
  totalUnreimbursedCents: number;
  /** Employees with unpaid mileage > $0 — payout queue length. */
  employeesAwaitingReimbursement: number;
}

export interface EmployeeMileageInputs {
  /** Optional yyyy-mm-dd window applied against tripDate. */
  fromDate?: string;
  toDate?: string;
  mileageEntries: MileageEntry[];
}

export function buildEmployeeMileageRollup(
  inputs: EmployeeMileageInputs,
): {
  rollup: EmployeeMileageRollup;
  rows: EmployeeMileageRow[];
} {
  const inRange = (d: string) => {
    if (inputs.fromDate && d < inputs.fromDate) return false;
    if (inputs.toDate && d > inputs.toDate) return false;
    return true;
  };

  type Bucket = {
    employeeId: string;
    employeeName: string;
    tripCount: number;
    totalMiles: number;
    reimbursable: number;
    reimbursed: number;
    days: Set<string>;
    perPurpose: Record<MileagePurpose, number>;
  };
  const buckets = new Map<string, Bucket>();

  for (const e of inputs.mileageEntries) {
    if (!inRange(e.tripDate)) continue;

    const b = buckets.get(e.employeeId) ?? {
      employeeId: e.employeeId,
      employeeName: e.employeeName,
      tripCount: 0,
      totalMiles: 0,
      reimbursable: 0,
      reimbursed: 0,
      days: new Set<string>(),
      perPurpose: emptyPurposeRecord(),
    };
    b.tripCount += 1;
    b.totalMiles += e.businessMiles;
    b.days.add(e.tripDate);
    b.perPurpose[e.purpose] += e.businessMiles;

    // Reimbursement only on personal-vehicle trips with a rate set.
    if (e.isPersonalVehicle && e.irsRateCentsPerMile != null) {
      const cents = Math.round(e.businessMiles * e.irsRateCentsPerMile);
      b.reimbursable += cents;
      if (e.reimbursed) b.reimbursed += cents;
    }
    buckets.set(e.employeeId, b);
  }

  const rows: EmployeeMileageRow[] = [];
  let totalMiles = 0;
  let totalReimbursable = 0;
  let totalReimbursed = 0;
  let awaiting = 0;

  for (const b of buckets.values()) {
    const unpaid = b.reimbursable - b.reimbursed;
    rows.push({
      employeeId: b.employeeId,
      employeeName: b.employeeName,
      tripCount: b.tripCount,
      totalMiles: round2(b.totalMiles),
      reimbursableCents: b.reimbursable,
      reimbursedCents: b.reimbursed,
      unreimbursedCents: unpaid,
      distinctDays: b.days.size,
      milesByPurpose: { ...b.perPurpose },
    });
    totalMiles += b.totalMiles;
    totalReimbursable += b.reimbursable;
    totalReimbursed += b.reimbursed;
    if (unpaid > 0) awaiting += 1;
  }

  // Highest unreimbursed first (payout queue).
  rows.sort((a, b) => b.unreimbursedCents - a.unreimbursedCents);

  return {
    rollup: {
      employeesConsidered: rows.length,
      totalMiles: round2(totalMiles),
      totalReimbursableCents: totalReimbursable,
      totalReimbursedCents: totalReimbursed,
      totalUnreimbursedCents: totalReimbursable - totalReimbursed,
      employeesAwaitingReimbursement: awaiting,
    },
    rows,
  };
}

function emptyPurposeRecord(): Record<MileagePurpose, number> {
  const out = {} as Record<MileagePurpose, number>;
  for (const k of PURPOSE_KEYS) out[k] = 0;
  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
