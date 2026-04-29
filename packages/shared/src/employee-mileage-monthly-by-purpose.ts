// Per (month, purpose) mileage rollup.
//
// Plain English: bucket mileage entries by (yyyy-mm of tripDate,
// MileagePurpose). Useful for spotting whether the FUEL-by-
// purpose mix is shifting (more SUPPLY_RUN miles each spring,
// more BID_WALK miles ahead of bid season).
//
// Per row: month, purpose, totalMiles, reimbursementCents,
// tripCount, distinctEmployees.
//
// Sort: month asc, purpose asc.
//
// Different from mileage-by-purpose (portfolio per purpose, no
// month axis), employee-mileage-monthly (per-employee per
// month).
//
// Pure derivation. No persisted records.

import type { MileageEntry, MileagePurpose } from './mileage';

export interface MileageMonthlyByPurposeRow {
  month: string;
  purpose: MileagePurpose;
  totalMiles: number;
  reimbursementCents: number;
  tripCount: number;
  distinctEmployees: number;
}

export interface MileageMonthlyByPurposeRollup {
  monthsConsidered: number;
  totalMiles: number;
  reimbursementCents: number;
}

export interface MileageMonthlyByPurposeInputs {
  mileageEntries: MileageEntry[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildMileageMonthlyByPurpose(
  inputs: MileageMonthlyByPurposeInputs,
): {
  rollup: MileageMonthlyByPurposeRollup;
  rows: MileageMonthlyByPurposeRow[];
} {
  type Acc = {
    month: string;
    purpose: MileagePurpose;
    miles: number;
    reimbursement: number;
    trips: number;
    employees: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const monthSet = new Set<string>();
  let totalMiles = 0;
  let totalReimbursement = 0;

  for (const m of inputs.mileageEntries) {
    const month = m.tripDate.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const reimb = m.isPersonalVehicle && m.irsRateCentsPerMile
      ? Math.round(m.businessMiles * m.irsRateCentsPerMile)
      : 0;
    const key = `${month}|${m.purpose}`;
    const acc = accs.get(key) ?? {
      month,
      purpose: m.purpose,
      miles: 0,
      reimbursement: 0,
      trips: 0,
      employees: new Set<string>(),
    };
    acc.miles += m.businessMiles;
    acc.reimbursement += reimb;
    acc.trips += 1;
    acc.employees.add(m.employeeId);
    accs.set(key, acc);
    monthSet.add(month);
    totalMiles += m.businessMiles;
    totalReimbursement += reimb;
  }

  const rows: MileageMonthlyByPurposeRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      month: acc.month,
      purpose: acc.purpose,
      totalMiles: Math.round(acc.miles * 100) / 100,
      reimbursementCents: acc.reimbursement,
      tripCount: acc.trips,
      distinctEmployees: acc.employees.size,
    });
  }

  rows.sort((a, b) => {
    if (a.month !== b.month) return a.month.localeCompare(b.month);
    return a.purpose.localeCompare(b.purpose);
  });

  return {
    rollup: {
      monthsConsidered: monthSet.size,
      totalMiles: Math.round(totalMiles * 100) / 100,
      reimbursementCents: totalReimbursement,
    },
    rows,
  };
}
