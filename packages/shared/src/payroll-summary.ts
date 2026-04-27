// Per-employee year-to-date payroll summary.
//
// Pure derivation. For each employee, walks every time card whose
// week falls in the requested year (or weeks the period straddles
// counting the days in-period) and aggregates:
//   - Regular hours, OT (×1.5), DT (×2 — currently nominal, OT module
//     in time-card emits weekly+daily OT split; DT is reserved)
//   - Gross wages = base × hours + OT/DT premium × OT hours
//   - Fringe = total fringe per DIR rate × all hours
//
// Caller passes the DIR rate that applied during the year for each
// classification — this drives all the math. The summary backs:
//   - Year-end W-2 prep (gross wages reconciliation)
//   - Quarterly 941 + DE-9 totals
//   - DOL audits + sub-listing pre-qual ("paid on every PW job")
//
// Phase 2 swaps "DIR rate looked up by classification" for "actual
// wage paid per pay period" once payroll runs are first-class records.

import {
  type Employee,
  classificationLabel,
  fullName,
  type DirClassification,
} from './employee';
import {
  type TimeCard,
  totalCardHours,
  overtimeHoursThisWeek,
} from './time-card';

export interface PayrollSummaryRow {
  employeeId: string;
  employeeName: string;
  classification: DirClassification;
  classificationLabel: string;

  /** Number of weeks (cards) the employee logged in the year. */
  weeksWorked: number;

  /** Hours splits across all the year's cards. */
  regularHours: number;
  /** Daily-OT (>8h on a workday) + weekly-OT (>40h after daily OT). */
  overtimeHours: number;
  totalHours: number;

  /** Base hourly rate from the DIR table (cents). */
  baseRateCentsPerHour: number;
  /** Total fringe components (cents/hr). */
  fringeRateCentsPerHour: number;

  /** Regular wages = regularHours × base. */
  regularWagesCents: number;
  /** OT wages = overtimeHours × base × 1.5. */
  overtimeWagesCents: number;
  /** Total fringe = totalHours × fringe rate. */
  fringeCents: number;
  /** Gross = regularWages + overtimeWages. (Fringe is a separate
   *  bucket because it's paid into trust funds, not to the employee
   *  on the W-2.) */
  grossWagesCents: number;

  /** Estimated employer-side payroll tax burden = grossWages × estimated
   *  rate. Caller passes the rate; drives 941 / DE-9 estimation. */
  employerTaxEstimateCents: number;
}

export interface PayrollSummaryInputs {
  year: number;
  employees: Employee[];
  timeCards: TimeCard[];
  /** Map from DirClassification to {base, fringe} cents/hr that
   *  applied during the year. Caller looks up from the DIR rate
   *  module per (classification, county, year). */
  ratesByClassification: Map<
    DirClassification,
    { baseCentsPerHour: number; fringeCentsPerHour: number }
  >;
  /** Estimated combined employer-side payroll tax rate (FICA + FUTA
   *  + SUTA + workers comp). Caller passes their actual fully-burdened
   *  rate. Defaults to 0.20 (a rough ballpark). */
  employerTaxRate?: number;
}

/** Build the summary. Returns one row per employee — all employees in
 *  the input list get a row even if they have zero hours, so the W-2
 *  reconciliation check finds everyone. */
export function buildPayrollSummary(inputs: PayrollSummaryInputs): PayrollSummaryRow[] {
  const {
    year,
    employees,
    timeCards,
    ratesByClassification,
    employerTaxRate = 0.2,
  } = inputs;

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  // Bucket cards by employee, in-year only.
  const cardsByEmployee = new Map<string, TimeCard[]>();
  for (const card of timeCards) {
    if (card.weekStarting > yearEnd) continue;
    if (card.weekStarting < yearStart) {
      // Skip cards entirely before year. A card that straddles the
      // year boundary at 12/29-1/4 still counts in the year of
      // weekStarting; that's a small approximation we accept for
      // Phase 1.
      continue;
    }
    const list = cardsByEmployee.get(card.employeeId) ?? [];
    list.push(card);
    cardsByEmployee.set(card.employeeId, list);
  }

  const rows: PayrollSummaryRow[] = [];
  for (const emp of employees) {
    const cards = cardsByEmployee.get(emp.id) ?? [];

    let regularHours = 0;
    let overtimeHours = 0;
    for (const card of cards) {
      const total = totalCardHours(card);
      const ot = overtimeHoursThisWeek(card);
      const otHours = ot.dailyOvertimeHours + ot.weeklyOvertimeHours;
      overtimeHours += otHours;
      regularHours += Math.max(0, total - otHours);
    }
    const totalHours = regularHours + overtimeHours;

    const rate =
      ratesByClassification.get(emp.classification) ?? {
        baseCentsPerHour: 0,
        fringeCentsPerHour: 0,
      };

    const regularWagesCents = Math.round(regularHours * rate.baseCentsPerHour);
    // OT premium = base × 1.5
    const overtimeWagesCents = Math.round(
      overtimeHours * rate.baseCentsPerHour * 1.5,
    );
    const fringeCents = Math.round(totalHours * rate.fringeCentsPerHour);
    const grossWagesCents = regularWagesCents + overtimeWagesCents;
    const employerTaxEstimateCents = Math.round(grossWagesCents * employerTaxRate);

    rows.push({
      employeeId: emp.id,
      employeeName: fullName(emp),
      classification: emp.classification,
      classificationLabel: classificationLabel(emp.classification),
      weeksWorked: cards.length,
      regularHours: round2(regularHours),
      overtimeHours: round2(overtimeHours),
      totalHours: round2(totalHours),
      baseRateCentsPerHour: rate.baseCentsPerHour,
      fringeRateCentsPerHour: rate.fringeCentsPerHour,
      regularWagesCents,
      overtimeWagesCents,
      fringeCents,
      grossWagesCents,
      employerTaxEstimateCents,
    });
  }

  // Sort by gross wages descending — biggest paychecks at the top so
  // the 941 reconciliation is in dollar order.
  rows.sort((a, b) => b.grossWagesCents - a.grossWagesCents);
  return rows;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface PayrollSummaryRollup {
  employees: number;
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalHours: number;
  totalGrossWagesCents: number;
  totalFringeCents: number;
  totalEmployerTaxEstimateCents: number;
}

export function computePayrollSummaryRollup(
  rows: PayrollSummaryRow[],
): PayrollSummaryRollup {
  let totalRegularHours = 0;
  let totalOvertimeHours = 0;
  let totalGrossWagesCents = 0;
  let totalFringeCents = 0;
  let totalEmployerTaxEstimateCents = 0;
  for (const r of rows) {
    totalRegularHours += r.regularHours;
    totalOvertimeHours += r.overtimeHours;
    totalGrossWagesCents += r.grossWagesCents;
    totalFringeCents += r.fringeCents;
    totalEmployerTaxEstimateCents += r.employerTaxEstimateCents;
  }
  return {
    employees: rows.length,
    totalRegularHours: round2(totalRegularHours),
    totalOvertimeHours: round2(totalOvertimeHours),
    totalHours: round2(totalRegularHours + totalOvertimeHours),
    totalGrossWagesCents,
    totalFringeCents,
    totalEmployerTaxEstimateCents,
  };
}
