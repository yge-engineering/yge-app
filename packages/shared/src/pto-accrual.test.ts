import { describe, it, expect } from 'vitest';
import {
  CA_STATUTORY_SICK_PLAN,
  PtoBalanceSchema,
  PtoPlanSchema,
  accrueForPayPeriod,
  daysSinceHire,
  frontload,
  isEligibleToUse,
  resetAnnualUsage,
  terminationPayoutHours,
  usePto,
  validateCaCompliance,
  type PtoBalance,
  type PtoPlan,
} from './pto-accrual';

const balanceFresh: PtoBalance = PtoBalanceSchema.parse({
  employeeId: 'emp-1',
  planId: CA_STATUTORY_SICK_PLAN.id,
  balanceHours: 0,
  usedThisYearHours: 0,
  asOfDate: '2026-01-01',
});

describe('CA_STATUTORY_SICK_PLAN', () => {
  it('passes its own compliance check', () => {
    expect(validateCaCompliance(CA_STATUTORY_SICK_PLAN)).toEqual([]);
  });
});

describe('validateCaCompliance', () => {
  it('flags an HOURLY plan that accrues slower than 1 per 30 h', () => {
    const plan: PtoPlan = PtoPlanSchema.parse({
      id: 'p',
      name: 'Slow plan',
      type: 'CA_SICK',
      accrualMethod: 'HOURLY',
      accrualPer30HoursWorked: 0.5,
      payoutOnTerm: false,
    });
    const issues = validateCaCompliance(plan);
    expect(issues.some((s) => s.includes('below CA minimum'))).toBe(true);
  });

  it('flags a FRONTLOAD plan that grants fewer than 40 h', () => {
    const plan: PtoPlan = PtoPlanSchema.parse({
      id: 'p',
      name: 'Stingy frontload',
      type: 'CA_SICK',
      accrualMethod: 'FRONTLOAD',
      frontloadHoursPerYear: 24,
      payoutOnTerm: false,
    });
    expect(validateCaCompliance(plan)).toEqual(
      expect.arrayContaining([expect.stringContaining('frontloadHoursPerYear')]),
    );
  });

  it('flags carryover cap below 80 h on HOURLY plans', () => {
    const plan: PtoPlan = PtoPlanSchema.parse({
      id: 'p',
      name: 'Low carry plan',
      type: 'CA_SICK',
      accrualMethod: 'HOURLY',
      accrualPer30HoursWorked: 1,
      carryoverCapHours: 48,
      payoutOnTerm: false,
    });
    expect(validateCaCompliance(plan)).toEqual(
      expect.arrayContaining([expect.stringContaining('carryoverCapHours')]),
    );
  });

  it('flags VACATION + PTO_COMBINED plans that do not pay out on term', () => {
    const vacation: PtoPlan = PtoPlanSchema.parse({
      id: 'p',
      name: 'Vacation no payout',
      type: 'VACATION',
      accrualMethod: 'HOURLY',
      accrualPer30HoursWorked: 1,
      payoutOnTerm: false,
    });
    const combined: PtoPlan = { ...vacation, type: 'PTO_COMBINED' };
    expect(validateCaCompliance(vacation)).toEqual(
      expect.arrayContaining([expect.stringContaining('payoutOnTerm')]),
    );
    expect(validateCaCompliance(combined)).toEqual(
      expect.arrayContaining([expect.stringContaining('payoutOnTerm')]),
    );
  });

  it('flags eligibility waiting period over 90 days', () => {
    const plan: PtoPlan = PtoPlanSchema.parse({
      id: 'p',
      name: 'Long wait',
      type: 'CA_SICK',
      accrualMethod: 'HOURLY',
      accrualPer30HoursWorked: 1,
      eligibilityDays: 180,
      payoutOnTerm: false,
    });
    expect(validateCaCompliance(plan)).toEqual(
      expect.arrayContaining([expect.stringContaining('eligibilityDays')]),
    );
  });
});

describe('accrueForPayPeriod (HOURLY)', () => {
  it('accrues 30 h worked → 1 h sick (1/30 rate)', () => {
    const r = accrueForPayPeriod(CA_STATUTORY_SICK_PLAN, balanceFresh, 30, '2026-01-14');
    expect(r.balanceHours).toBe(1);
    expect(r.asOfDate).toBe('2026-01-14');
  });

  it('accrues a fractional period correctly', () => {
    const r = accrueForPayPeriod(CA_STATUTORY_SICK_PLAN, balanceFresh, 45, '2026-01-14');
    expect(r.balanceHours).toBe(1.5);
  });

  it('caps accrued balance at carryoverCapHours', () => {
    const near: PtoBalance = { ...balanceFresh, balanceHours: 79.5 };
    const r = accrueForPayPeriod(CA_STATUTORY_SICK_PLAN, near, 30, '2026-02-01');
    // 79.5 + 1 = 80.5, capped at 80.
    expect(r.balanceHours).toBe(80);
  });

  it('rejects negative hoursWorked', () => {
    expect(() =>
      accrueForPayPeriod(CA_STATUTORY_SICK_PLAN, balanceFresh, -1, '2026-01-14'),
    ).toThrow();
  });

  it('FRONTLOAD plans do not accrue on hours worked', () => {
    const plan: PtoPlan = PtoPlanSchema.parse({
      id: 'p',
      name: 'Front 40',
      type: 'CA_SICK',
      accrualMethod: 'FRONTLOAD',
      frontloadHoursPerYear: 40,
      payoutOnTerm: false,
    });
    const r = accrueForPayPeriod(plan, balanceFresh, 60, '2026-01-14');
    expect(r.balanceHours).toBe(0);
    expect(r.asOfDate).toBe('2026-01-14');
  });
});

describe('frontload', () => {
  it('grants the yearly amount and resets used-this-year', () => {
    const plan: PtoPlan = PtoPlanSchema.parse({
      id: 'p',
      name: 'Front 40',
      type: 'CA_SICK',
      accrualMethod: 'FRONTLOAD',
      frontloadHoursPerYear: 40,
      payoutOnTerm: false,
    });
    const dirty: PtoBalance = { ...balanceFresh, balanceHours: 10, usedThisYearHours: 30 };
    const r = frontload(plan, dirty, '2026-01-01');
    expect(r.balanceHours).toBe(40);
    expect(r.usedThisYearHours).toBe(0);
  });

  it('is a no-op on HOURLY plans', () => {
    const r = frontload(CA_STATUTORY_SICK_PLAN, balanceFresh, '2026-01-01');
    expect(r.balanceHours).toBe(0);
  });
});

describe('resetAnnualUsage', () => {
  it('zeros usedThisYearHours but keeps balance', () => {
    const used: PtoBalance = { ...balanceFresh, balanceHours: 60, usedThisYearHours: 40 };
    const r = resetAnnualUsage(used, '2027-01-01');
    expect(r.balanceHours).toBe(60);
    expect(r.usedThisYearHours).toBe(0);
    expect(r.asOfDate).toBe('2027-01-01');
  });
});

describe('usePto', () => {
  const stocked: PtoBalance = { ...balanceFresh, balanceHours: 24, usedThisYearHours: 0 };

  it('deducts hours and increments used-this-year', () => {
    const r = usePto(CA_STATUTORY_SICK_PLAN, stocked, 8, '2026-03-01');
    expect(r.balanceHours).toBe(16);
    expect(r.usedThisYearHours).toBe(8);
  });

  it('throws on overdraw of balance', () => {
    expect(() => usePto(CA_STATUTORY_SICK_PLAN, stocked, 25, '2026-03-01')).toThrow(
      /exceeds available balance/,
    );
  });

  it('throws on overrun of yearly usable cap', () => {
    const heavy: PtoBalance = { ...balanceFresh, balanceHours: 80, usedThisYearHours: 35 };
    expect(() => usePto(CA_STATUTORY_SICK_PLAN, heavy, 8, '2026-08-01')).toThrow(
      /yearly usable cap/,
    );
  });

  it('rejects 0 and negative requests', () => {
    expect(() => usePto(CA_STATUTORY_SICK_PLAN, stocked, 0, '2026-03-01')).toThrow();
    expect(() => usePto(CA_STATUTORY_SICK_PLAN, stocked, -4, '2026-03-01')).toThrow();
  });
});

describe('terminationPayoutHours', () => {
  it('returns 0 for non-payout plans (CA sick)', () => {
    const b: PtoBalance = { ...balanceFresh, balanceHours: 72 };
    expect(terminationPayoutHours(CA_STATUTORY_SICK_PLAN, b)).toBe(0);
  });

  it('returns the full balance for vacation plans', () => {
    const vacation: PtoPlan = PtoPlanSchema.parse({
      id: 'p',
      name: 'Vacation',
      type: 'VACATION',
      accrualMethod: 'HOURLY',
      accrualPer30HoursWorked: 1,
      payoutOnTerm: true,
    });
    const b: PtoBalance = { ...balanceFresh, balanceHours: 64.5 };
    expect(terminationPayoutHours(vacation, b)).toBe(64.5);
  });
});

describe('daysSinceHire + isEligibleToUse', () => {
  it('counts whole days between iso dates', () => {
    expect(daysSinceHire('2026-01-01', '2026-04-01')).toBe(90);
    expect(daysSinceHire('2026-01-01', '2026-03-31')).toBe(89);
    expect(daysSinceHire('2026-01-01', '2025-12-31')).toBe(-1);
  });

  it('eligibility flips at the 90-day mark', () => {
    expect(isEligibleToUse(CA_STATUTORY_SICK_PLAN, '2026-01-01', '2026-03-31')).toBe(false);
    expect(isEligibleToUse(CA_STATUTORY_SICK_PLAN, '2026-01-01', '2026-04-01')).toBe(true);
  });
});
