// California meal + rest period premium-pay calculator.
//
// Per CA Labor Code §226.7(c): when an employer fails to provide a
// compliant meal OR rest period, the employer owes ONE additional
// hour of pay at the employee's regular rate of compensation per
// workday on which the violation occurred.
//
// Per Augustus v. ABM (2016) and Murphy v. Kenneth Cole (2007): the
// premium is a wage, not a penalty — subject to wage-and-hour rules
// + recoverable in a wage claim. Per Donohue v. AMN (2021): rounding
// time records that hide meal-period violations doesn't shield the
// employer.
//
// Key rule from §226.7(c) + DLSE Manual §45.4:
//   - One premium hour per workday MAX, even if both a meal AND a
//     rest violation happened that same day. (Some practitioners
//     argue two are owed; the conservative + statute-text reading is
//     one. This calculator returns the conservative number with a
//     flag callers can expand on.)
//   - The "regular rate" includes nondiscretionary bonuses + shift
//     differentials. Caller supplies the regular rate; this module
//     does not compute regular-rate math.
//   - Late meal (started after end of 5th hour) counts as a missed
//     meal for premium purposes.
//   - Short meal (under 30 min) counts as a missed meal.
//
// This module is a thin layer over ca-shift-rules: it runs that
// engine on each shift, classifies each violation as MEAL / REST,
// and aggregates per-workday premium owed.
//
// Pure: no side effects, no clock dependency.

import { evaluateShift, type ShiftInput, type ShiftViolation } from './ca-shift-rules';

export type PremiumKind = 'MEAL' | 'REST';

export interface ShiftForPremium {
  /** Employee id — for grouping output. */
  employeeId: string;
  /** Date the shift started, yyyy-mm-dd. */
  workDate: string;
  /** Optional regular hourly rate in cents (used to compute dollar
   *  amount; if omitted, only hours are returned). */
  regularRateCents?: number;
  shift: ShiftInput;
}

export interface DailyPremiumRow {
  employeeId: string;
  workDate: string;
  /** True if at least one MEAL violation triggered the premium. */
  mealPremiumTriggered: boolean;
  /** True if at least one REST violation triggered the premium. */
  restPremiumTriggered: boolean;
  /** Hours owed (typically 1.0; see calcMode below). */
  premiumHours: number;
  /** Premium amount in cents — premiumHours × regularRateCents if
   *  the caller supplied a rate, else 0. */
  premiumCents: number;
  /** Verbatim violations from ca-shift-rules — for the audit trail. */
  violations: ShiftViolation[];
}

export type PremiumCalcMode =
  /** Statute-text conservative reading: one premium hour per workday
   *  even if both meal AND rest were missed. */
  | 'CONSERVATIVE'
  /** Plaintiff-favorable reading: one for meal + one for rest = up to
   *  two premium hours per workday. */
  | 'AGGRESSIVE';

export interface PremiumCalcOptions {
  mode?: PremiumCalcMode;
}

const MEAL_CODES = new Set<ShiftViolation['code']>([
  'NO_MEAL_PERIOD',
  'SHORT_FIRST_MEAL',
  'LATE_FIRST_MEAL',
  'NO_SECOND_MEAL',
  'SHORT_SECOND_MEAL',
]);
const REST_CODES = new Set<ShiftViolation['code']>(['MISSING_REST_BREAK']);

/** Process a list of shifts; return one row per (employee, workDate).
 *  When the same (employee, workDate) appears multiple times in the
 *  input, the rows are merged — premium hours don't double-count. */
export function calcMealRestPremium(
  shifts: ShiftForPremium[],
  options: PremiumCalcOptions = {},
): DailyPremiumRow[] {
  const mode: PremiumCalcMode = options.mode ?? 'CONSERVATIVE';
  // Index by (employeeId, workDate).
  const byKey = new Map<string, DailyPremiumRow>();
  for (const s of shifts) {
    const key = `${s.employeeId}|${s.workDate}`;
    const violations = evaluateShift(s.shift);
    const hasMeal = violations.some((v) => MEAL_CODES.has(v.code));
    const hasRest = violations.some((v) => REST_CODES.has(v.code));
    let row = byKey.get(key);
    if (!row) {
      row = {
        employeeId: s.employeeId,
        workDate: s.workDate,
        mealPremiumTriggered: false,
        restPremiumTriggered: false,
        premiumHours: 0,
        premiumCents: 0,
        violations: [],
      };
      byKey.set(key, row);
    }
    row.mealPremiumTriggered = row.mealPremiumTriggered || hasMeal;
    row.restPremiumTriggered = row.restPremiumTriggered || hasRest;
    row.violations.push(...violations);
    // Compute premium hours per the mode.
    const triggered =
      (row.mealPremiumTriggered ? 1 : 0) + (row.restPremiumTriggered ? 1 : 0);
    row.premiumHours = mode === 'AGGRESSIVE' ? triggered : Math.min(triggered, 1);
    if (s.regularRateCents !== undefined && row.premiumHours > 0) {
      row.premiumCents = Math.round(row.premiumHours * s.regularRateCents);
    }
  }
  return Array.from(byKey.values()).sort((a, b) =>
    a.workDate === b.workDate
      ? a.employeeId.localeCompare(b.employeeId)
      : a.workDate.localeCompare(b.workDate),
  );
}

/** Sum across all rows for a payroll-period summary. */
export function totalPremium(rows: DailyPremiumRow[]): {
  totalDays: number;
  totalHours: number;
  totalCents: number;
} {
  return rows.reduce(
    (acc, r) => ({
      totalDays: acc.totalDays + (r.premiumHours > 0 ? 1 : 0),
      totalHours: round2(acc.totalHours + r.premiumHours),
      totalCents: acc.totalCents + r.premiumCents,
    }),
    { totalDays: 0, totalHours: 0, totalCents: 0 },
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
