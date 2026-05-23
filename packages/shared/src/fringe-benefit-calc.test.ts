import { describe, it, expect } from 'vitest';
import { calcFringe, FringeInputSchema } from './fringe-benefit-calc';

describe('calcFringe', () => {
  it('zero fringe → zero savings', () => {
    const out = calcFringe(
      FringeInputSchema.parse({
        baseHourlyCents: 5000,
        fringeHourlyCents: 0,
        hours: 40,
      }),
    );
    expect(out.savingsTotalCents).toBe(0);
    expect(out.cashInLieuTotalCents).toBe(0);
    expect(out.paidToFundTotalCents).toBe(0);
  });

  it('default 20% tax: $20/hr fringe × 40 hr → $160 savings (paid-to-fund saves the tax)', () => {
    // fringe = 2000 cents/hr × 40 = 80000 cents. tax = 0.20 × 80000 = 16000.
    // cash-in-lieu cost = 80000 + 16000 = 96000. paid-to-fund = 80000.
    // savings = 16000 cents = $160.
    const out = calcFringe(
      FringeInputSchema.parse({
        baseHourlyCents: 5000,
        fringeHourlyCents: 2000,
        hours: 40,
      }),
    );
    expect(out.cashInLieuTotalCents).toBe(96000);
    expect(out.paidToFundTotalCents).toBe(80000);
    expect(out.savingsTotalCents).toBe(16000);
    expect(out.cashInLieuPayrollTaxCents).toBe(16000);
  });

  it('per-hour savings is consistent with annual projection (2080 hr)', () => {
    const out = calcFringe(
      FringeInputSchema.parse({
        baseHourlyCents: 5000,
        fringeHourlyCents: 2000,
        hours: 1,
      }),
    );
    expect(out.savingsPerHourCents).toBe(out.savingsTotalCents);
    expect(out.annualSavingsCents).toBe(out.savingsPerHourCents * 2080);
  });

  it('custom tax rate', () => {
    const out = calcFringe(
      FringeInputSchema.parse({
        baseHourlyCents: 5000,
        fringeHourlyCents: 1000,
        hours: 1,
        employerTaxRate: 0.10,
      }),
    );
    // fringe = 1000, tax = 100, cash = 1100, paid = 1000, savings = 100.
    expect(out.savingsPerHourCents).toBe(100);
  });

  it('zero hours guard', () => {
    const out = calcFringe(
      FringeInputSchema.parse({
        baseHourlyCents: 5000,
        fringeHourlyCents: 2000,
        hours: 0,
      }),
    );
    expect(out.savingsPerHourCents).toBe(0);
    expect(out.annualSavingsCents).toBe(0);
  });
});
