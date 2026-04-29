// Portfolio mileage year-over-year.
//
// Plain English: collapse two consecutive fiscal years of
// mileage into a single comparison row. Useful for the year-
// end "where did windshield time go?" review and the
// IRS-rate cost trend.
//
// Per row: prior + current trips, miles, reimbursableCents,
// distinctEmployees plus deltas.
//
// Different from mileage-by-purpose-monthly (per month per
// purpose), employee-mileage-rollup (per employee lifetime).
//
// Pure derivation. No persisted records.

import type { MileageEntry } from './mileage';

export interface PortfolioMileageYoyResult {
  priorYear: number;
  currentYear: number;
  priorTrips: number;
  priorMiles: number;
  priorReimbursableCents: number;
  priorDistinctEmployees: number;
  currentTrips: number;
  currentMiles: number;
  currentReimbursableCents: number;
  currentDistinctEmployees: number;
  tripsDelta: number;
  milesDelta: number;
  reimbursableCentsDelta: number;
}

export interface PortfolioMileageYoyInputs {
  mileage: MileageEntry[];
  /** The current (later) year. Prior year is currentYear - 1. */
  currentYear: number;
}

export function buildPortfolioMileageYoy(
  inputs: PortfolioMileageYoyInputs,
): PortfolioMileageYoyResult {
  const priorYear = inputs.currentYear - 1;

  let priorTrips = 0;
  let priorMiles = 0;
  let priorReimb = 0;
  const priorEmployees = new Set<string>();
  let currentTrips = 0;
  let currentMiles = 0;
  let currentReimb = 0;
  const currentEmployees = new Set<string>();

  for (const m of inputs.mileage) {
    const year = Number(m.tripDate.slice(0, 4));
    const reimb = m.isPersonalVehicle && m.irsRateCentsPerMile
      ? Math.round(m.businessMiles * m.irsRateCentsPerMile)
      : 0;
    if (year === priorYear) {
      priorTrips += 1;
      priorMiles += m.businessMiles;
      priorReimb += reimb;
      priorEmployees.add(m.employeeId);
    } else if (year === inputs.currentYear) {
      currentTrips += 1;
      currentMiles += m.businessMiles;
      currentReimb += reimb;
      currentEmployees.add(m.employeeId);
    }
  }

  return {
    priorYear,
    currentYear: inputs.currentYear,
    priorTrips,
    priorMiles,
    priorReimbursableCents: priorReimb,
    priorDistinctEmployees: priorEmployees.size,
    currentTrips,
    currentMiles,
    currentReimbursableCents: currentReimb,
    currentDistinctEmployees: currentEmployees.size,
    tripsDelta: currentTrips - priorTrips,
    milesDelta: currentMiles - priorMiles,
    reimbursableCentsDelta: currentReimb - priorReimb,
  };
}
