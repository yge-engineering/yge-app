// PW fringe-benefit cost calculator — cash-in-lieu vs paid-to-fund.
//
// California prevailing-wage law lets you satisfy the fringe portion of the
// wage either by paying it as cash to the worker (taxable W-2 wages) or by
// paying it to a qualified fund / health plan / pension (not taxable). The
// employer pays payroll taxes on cash-in-lieu but not on paid-to-fund. The
// gap is real money over a year of hours.
//
// All money is in CENTS for consistency with the rest of the system.

import { z } from 'zod';

export const FringeInputSchema = z.object({
  /** Hourly base wage in cents (the non-fringe portion). */
  baseHourlyCents: z.number().int().nonnegative(),
  /** Hourly fringe rate in cents (the portion this calculator splits). */
  fringeHourlyCents: z.number().int().nonnegative(),
  /** Hours worked over the period (default 1, so output is per-hour). */
  hours: z.number().nonnegative().default(1),
  /** Employer payroll-tax rate (FICA + WC + UI) as a fraction.
   *  Default 0.20 ≈ 7.65% FICA + ~10% WC for heavy-civil + ~2% UI/ETT. */
  employerTaxRate: z.number().min(0).max(1).default(0.2),
});
export type FringeInput = z.infer<typeof FringeInputSchema>;

export interface FringeOutput {
  /** Cash-in-lieu total cost (fringe paid as taxable wages). */
  cashInLieuTotalCents: number;
  /** Paid-to-fund total cost (fringe paid to qualified plan). */
  paidToFundTotalCents: number;
  /** Savings = cashInLieuTotal - paidToFundTotal. */
  savingsTotalCents: number;
  /** Per-hour savings. */
  savingsPerHourCents: number;
  /** Annual savings projection (savingsPerHour × 2080). */
  annualSavingsCents: number;
  /** Effective tax cost of cash-in-lieu, in cents, for the period. */
  cashInLieuPayrollTaxCents: number;
}

export function calcFringe(input: FringeInput): FringeOutput {
  const fringePerHour = input.fringeHourlyCents;
  const hours = input.hours;
  const taxRate = input.employerTaxRate;

  const fringeTotal = Math.round(fringePerHour * hours);
  const cashTax = Math.round(fringeTotal * taxRate);
  const cashInLieuTotal = fringeTotal + cashTax;
  const paidToFundTotal = fringeTotal;
  const savings = cashInLieuTotal - paidToFundTotal;
  const savingsPerHour = hours > 0 ? Math.round(savings / hours) : 0;
  const annualSavings = Math.round(savingsPerHour * 2080);

  return {
    cashInLieuTotalCents: cashInLieuTotal,
    paidToFundTotalCents: paidToFundTotal,
    savingsTotalCents: savings,
    savingsPerHourCents: savingsPerHour,
    annualSavingsCents: annualSavings,
    cashInLieuPayrollTaxCents: cashTax,
  };
}
