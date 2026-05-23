// California sick-leave + PTO accrual engine.
//
// Per CA Labor Code §246 (Healthy Workplaces / Healthy Families Act, as
// amended in 2024 by SB 616):
//   - Default accrual: 1 hour of paid sick leave per 30 hours worked.
//   - Annual usable cap: at least 40 h (5 days) per 12-month period.
//   - Carryover cap: at least 80 h (10 days), unless the employer
//     "frontloads" 40 h at the start of each year (which skips accrual
//     and carryover bookkeeping entirely).
//   - 90-day eligibility waiting period from hire date before the
//     balance can be used.
//   - PTO / vacation: CA treats accrued vacation as wages → must be paid
//     out at termination. Pure sick leave: no payout obligation.
//   - Combined PTO that does NOT distinguish sick from vacation is
//     treated as vacation under CA wage-protection law → payout required.
//
// This file is the pure-math layer:
//   - validateCaCompliance(plan)        — sanity-check a plan vs CA mins.
//   - accrueForPayPeriod(plan, b, h, d) — add this period's accrual,
//                                          respect carryover cap.
//   - frontload(plan, b, d)             — yearly grant for FRONTLOAD plans.
//   - resetAnnualUsage(b, d)            — yearly rollover for HOURLY plans.
//   - usePto(plan, b, h, d)             — deduct used hours, enforce caps.
//   - terminationPayoutHours(plan, b)   — wage payout obligation at term.
//   - isEligibleToUse(plan, hire, asOf) — past the 90-day waiting period?
//
// No side effects; nothing throws on the validate path so callers decide
// whether to block. usePto throws because over-using is a correctness bug,
// not a policy choice.

import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const PtoPlanTypeSchema = z.enum(['CA_SICK', 'VACATION', 'PTO_COMBINED']);
export type PtoPlanType = z.infer<typeof PtoPlanTypeSchema>;

export const PtoAccrualMethodSchema = z.enum(['HOURLY', 'FRONTLOAD']);
export type PtoAccrualMethod = z.infer<typeof PtoAccrualMethodSchema>;

export const PtoPlanSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(200),
  type: PtoPlanTypeSchema,
  accrualMethod: PtoAccrualMethodSchema,
  /** HOURLY only: hours of PTO accrued per 30 hours worked.
   *  CA statutory minimum for sick leave is 1.0 (=1h per 30h). */
  accrualPer30HoursWorked: z.number().nonnegative().optional(),
  /** FRONTLOAD only: hours granted at start of each plan year.
   *  CA statutory minimum for sick leave is 40. */
  frontloadHoursPerYear: z.number().nonnegative().optional(),
  /** Cap on usable balance per year. CA statutory minimum is 40 h.
   *  Use 0 to mean "no cap" — only legal for non-CA-sick plans. */
  usableCapHours: z.number().nonnegative().default(40),
  /** Cap on carried-over balance. CA statutory minimum is 80 h for HOURLY
   *  plans. 0 = no cap. Ignored for FRONTLOAD (no carryover). */
  carryoverCapHours: z.number().nonnegative().default(80),
  /** Days from hire date before the EE can use the balance. CA cap is 90. */
  eligibilityDays: z.number().int().nonnegative().default(90),
  /** Pay remaining balance out at termination?
   *  CA: required = true for VACATION + PTO_COMBINED; optional for CA_SICK. */
  payoutOnTerm: z.boolean(),
});
export type PtoPlan = z.infer<typeof PtoPlanSchema>;

export const PtoBalanceSchema = z.object({
  employeeId: z.string().min(1),
  planId: z.string().min(1),
  /** Current accrued balance in hours. */
  balanceHours: z.number().nonnegative(),
  /** Hours used since the plan year started — counts against usableCapHours. */
  usedThisYearHours: z.number().nonnegative().default(0),
  /** Last date the balance was updated (yyyy-mm-dd). */
  asOfDate: z.string().regex(ISO_DATE, 'Use yyyy-mm-dd'),
});
export type PtoBalance = z.infer<typeof PtoBalanceSchema>;

// CA statutory minimums (CLC §246 as amended by SB 616 effective 2024-01-01).
const CA_STATUTORY_ACCRUAL_PER_30H = 1;
const CA_MIN_USABLE_HOURS = 40;
const CA_MIN_CARRYOVER_HOURS = 80;
const CA_MAX_ELIGIBILITY_DAYS = 90;

/** CA statutory default sick-leave plan — copy this and edit `id` + `name`
 *  for company-specific tweaks. */
export const CA_STATUTORY_SICK_PLAN: PtoPlan = {
  id: 'ca-statutory-sick',
  name: 'CA Statutory Sick Leave (SB 616)',
  type: 'CA_SICK',
  accrualMethod: 'HOURLY',
  accrualPer30HoursWorked: CA_STATUTORY_ACCRUAL_PER_30H,
  usableCapHours: CA_MIN_USABLE_HOURS,
  carryoverCapHours: CA_MIN_CARRYOVER_HOURS,
  eligibilityDays: CA_MAX_ELIGIBILITY_DAYS,
  payoutOnTerm: false,
};

/** Validate a plan against CA statutory minimums. Returns array of human-
 *  readable issues; empty = compliant. Does not throw. */
export function validateCaCompliance(plan: PtoPlan): string[] {
  const issues: string[] = [];
  if (plan.eligibilityDays > CA_MAX_ELIGIBILITY_DAYS) {
    issues.push(
      `eligibilityDays ${plan.eligibilityDays} exceeds CA maximum of ${CA_MAX_ELIGIBILITY_DAYS}`,
    );
  }
  if (plan.accrualMethod === 'HOURLY') {
    const rate = plan.accrualPer30HoursWorked ?? 0;
    if (rate < CA_STATUTORY_ACCRUAL_PER_30H) {
      issues.push(
        `accrual rate of ${rate} h per 30 h worked is below CA minimum of ${CA_STATUTORY_ACCRUAL_PER_30H}`,
      );
    }
    if (plan.carryoverCapHours > 0 && plan.carryoverCapHours < CA_MIN_CARRYOVER_HOURS) {
      issues.push(
        `carryoverCapHours ${plan.carryoverCapHours} below CA minimum of ${CA_MIN_CARRYOVER_HOURS}`,
      );
    }
  } else {
    const front = plan.frontloadHoursPerYear ?? 0;
    if (front < CA_MIN_USABLE_HOURS) {
      issues.push(
        `frontloadHoursPerYear ${front} below CA minimum of ${CA_MIN_USABLE_HOURS}`,
      );
    }
  }
  if (plan.usableCapHours > 0 && plan.usableCapHours < CA_MIN_USABLE_HOURS) {
    issues.push(
      `usableCapHours ${plan.usableCapHours} below CA minimum of ${CA_MIN_USABLE_HOURS}`,
    );
  }
  if ((plan.type === 'VACATION' || plan.type === 'PTO_COMBINED') && !plan.payoutOnTerm) {
    issues.push(
      `${plan.type} plans must payoutOnTerm = true under CA wage-protection rules`,
    );
  }
  return issues;
}

/** Add accrual for a pay period to the balance.
 *  Pure: returns a new balance object; never mutates the input. */
export function accrueForPayPeriod(
  plan: PtoPlan,
  balance: PtoBalance,
  hoursWorked: number,
  asOfDate: string,
): PtoBalance {
  if (plan.accrualMethod !== 'HOURLY') {
    return { ...balance, asOfDate };
  }
  if (hoursWorked < 0) {
    throw new Error('hoursWorked cannot be negative');
  }
  const rate = plan.accrualPer30HoursWorked ?? 0;
  const accrued = (hoursWorked / 30) * rate;
  let newBalance = balance.balanceHours + accrued;
  if (plan.carryoverCapHours > 0) {
    newBalance = Math.min(newBalance, plan.carryoverCapHours);
  }
  return { ...balance, balanceHours: round2(newBalance), asOfDate };
}

/** Apply the year-start frontload grant. Resets used-this-year to 0.
 *  No-op on HOURLY plans. */
export function frontload(plan: PtoPlan, balance: PtoBalance, asOfDate: string): PtoBalance {
  if (plan.accrualMethod !== 'FRONTLOAD') return { ...balance, asOfDate };
  return {
    ...balance,
    balanceHours: plan.frontloadHoursPerYear ?? 0,
    usedThisYearHours: 0,
    asOfDate,
  };
}

/** Reset used-this-year counter (annual rollover for HOURLY plans). */
export function resetAnnualUsage(balance: PtoBalance, asOfDate: string): PtoBalance {
  return { ...balance, usedThisYearHours: 0, asOfDate };
}

/** Deduct used hours from the balance. Throws when the request would
 *  overdraw or exceed the yearly usable cap — callers should validate
 *  before submitting timecards. */
export function usePto(
  plan: PtoPlan,
  balance: PtoBalance,
  requestedHours: number,
  asOfDate: string,
): PtoBalance {
  if (requestedHours <= 0) {
    throw new Error('requestedHours must be positive');
  }
  if (requestedHours > balance.balanceHours) {
    throw new Error(
      `requested ${requestedHours} h exceeds available balance ${balance.balanceHours} h`,
    );
  }
  if (plan.usableCapHours > 0) {
    const newUsed = balance.usedThisYearHours + requestedHours;
    if (newUsed > plan.usableCapHours) {
      throw new Error(
        `requested ${requestedHours} h plus already-used ${balance.usedThisYearHours} h exceeds yearly usable cap of ${plan.usableCapHours} h`,
      );
    }
  }
  return {
    ...balance,
    balanceHours: round2(balance.balanceHours - requestedHours),
    usedThisYearHours: round2(balance.usedThisYearHours + requestedHours),
    asOfDate,
  };
}

/** Hours that must be paid out at termination. 0 if the plan opts out
 *  (allowed only for CA_SICK). */
export function terminationPayoutHours(plan: PtoPlan, balance: PtoBalance): number {
  if (!plan.payoutOnTerm) return 0;
  return round2(balance.balanceHours);
}

/** Whole days between two ISO yyyy-mm-dd dates, asOf - hire.
 *  Negative if asOfDate precedes hireDate. */
export function daysSinceHire(hireDate: string, asOfDate: string): number {
  const a = parseIso(hireDate);
  const b = parseIso(asOfDate);
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

/** True if the employee has cleared the plan's eligibility window. */
export function isEligibleToUse(
  plan: PtoPlan,
  hireDate: string,
  asOfDate: string,
): boolean {
  return daysSinceHire(hireDate, asOfDate) >= plan.eligibilityDays;
}

function parseIso(s: string): number {
  return Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
