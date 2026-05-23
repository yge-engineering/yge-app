import { describe, it, expect } from 'vitest';
import {
  calcMealRestPremium,
  totalPremium,
  type ShiftForPremium,
} from './meal-premium-calc';

// Helpers — minutes since midnight.
const h = (n: number) => n * 60;

function shift(over: Partial<ShiftForPremium['shift']> = {}): ShiftForPremium['shift'] {
  // Default: clean 8-h shift with one compliant meal + two rest breaks.
  return {
    clockInMin: h(7),
    clockOutMin: h(15.5),
    meals: [{ startMin: h(11), endMin: h(11.5) }],
    rests: [
      { startMin: h(9), endMin: h(9 + 10 / 60) },
      { startMin: h(13), endMin: h(13 + 10 / 60) },
    ],
    ...over,
  };
}

function row(employeeId: string, workDate: string, overShift: Partial<ShiftForPremium['shift']> = {}, regularRateCents?: number): ShiftForPremium {
  return { employeeId, workDate, shift: shift(overShift), regularRateCents };
}

describe('calcMealRestPremium — compliant shift', () => {
  it('returns row with no premium when shift is clean', () => {
    const r = calcMealRestPremium([row('e1', '2026-05-22')]);
    expect(r).toHaveLength(1);
    expect(r[0]!.premiumHours).toBe(0);
    expect(r[0]!.mealPremiumTriggered).toBe(false);
    expect(r[0]!.restPremiumTriggered).toBe(false);
  });
});

describe('calcMealRestPremium — meal violations', () => {
  it('flags missing meal period as 1 premium hour', () => {
    const r = calcMealRestPremium([
      row('e1', '2026-05-22', { meals: [] }),
    ]);
    expect(r[0]!.mealPremiumTriggered).toBe(true);
    expect(r[0]!.premiumHours).toBe(1);
  });

  it('flags short meal (<30 min) as missed meal', () => {
    const r = calcMealRestPremium([
      row('e1', '2026-05-22', {
        meals: [{ startMin: h(11), endMin: h(11 + 15 / 60) }],
      }),
    ]);
    expect(r[0]!.mealPremiumTriggered).toBe(true);
  });

  it('flags late meal (started after end of 5th hour)', () => {
    const r = calcMealRestPremium([
      row('e1', '2026-05-22', {
        // 7am to 5pm = 10h shift; meal at 1pm = started in the 6th hour.
        clockInMin: h(7),
        clockOutMin: h(17),
        meals: [{ startMin: h(13), endMin: h(13.5) }],
      }),
    ]);
    expect(r[0]!.mealPremiumTriggered).toBe(true);
  });
});

describe('calcMealRestPremium — rest violations', () => {
  it('flags missing rest break', () => {
    const r = calcMealRestPremium([
      row('e1', '2026-05-22', { rests: [] }),
    ]);
    expect(r[0]!.restPremiumTriggered).toBe(true);
    expect(r[0]!.premiumHours).toBe(1);
  });
});

describe('calcMealRestPremium — mode = CONSERVATIVE vs AGGRESSIVE', () => {
  const both = row('e1', '2026-05-22', { meals: [], rests: [] });

  it('CONSERVATIVE caps premium hours at 1 even with both violations', () => {
    const r = calcMealRestPremium([both], { mode: 'CONSERVATIVE' });
    expect(r[0]!.premiumHours).toBe(1);
    expect(r[0]!.mealPremiumTriggered).toBe(true);
    expect(r[0]!.restPremiumTriggered).toBe(true);
  });

  it('AGGRESSIVE gives one hour for meal + one for rest = 2', () => {
    const r = calcMealRestPremium([both], { mode: 'AGGRESSIVE' });
    expect(r[0]!.premiumHours).toBe(2);
  });
});

describe('calcMealRestPremium — premium dollar amount', () => {
  it('computes premiumCents = hours × regularRateCents', () => {
    const r = calcMealRestPremium([
      row('e1', '2026-05-22', { meals: [] }, 35_50), // $35.50/hr
    ]);
    expect(r[0]!.premiumHours).toBe(1);
    expect(r[0]!.premiumCents).toBe(35_50);
  });

  it('leaves premiumCents at 0 if no rate supplied', () => {
    const r = calcMealRestPremium([row('e1', '2026-05-22', { meals: [] })]);
    expect(r[0]!.premiumCents).toBe(0);
  });
});

describe('calcMealRestPremium — multi-shift per day merge', () => {
  it('merges multiple shifts on the same date without double-charging', () => {
    const a = row('e1', '2026-05-22', { meals: [] });
    const b = row('e1', '2026-05-22', { rests: [] });
    const r = calcMealRestPremium([a, b], { mode: 'CONSERVATIVE' });
    expect(r).toHaveLength(1);
    expect(r[0]!.premiumHours).toBe(1); // still capped at 1 under CONSERVATIVE
    expect(r[0]!.mealPremiumTriggered).toBe(true);
    expect(r[0]!.restPremiumTriggered).toBe(true);
  });

  it('keeps different employees separate', () => {
    const a = row('e1', '2026-05-22', { meals: [] });
    const b = row('e2', '2026-05-22', { meals: [] });
    const r = calcMealRestPremium([a, b]);
    expect(r).toHaveLength(2);
    expect(r.map((x) => x.employeeId).sort()).toEqual(['e1', 'e2']);
  });

  it('keeps different dates separate', () => {
    const a = row('e1', '2026-05-22', { meals: [] });
    const b = row('e1', '2026-05-23', { meals: [] });
    const r = calcMealRestPremium([a, b]);
    expect(r).toHaveLength(2);
  });
});

describe('totalPremium', () => {
  it('rolls up days + hours + cents', () => {
    const a = row('e1', '2026-05-22', { meals: [] }, 35_00);
    const b = row('e2', '2026-05-23', { rests: [] }, 40_00);
    const c = row('e3', '2026-05-24'); // clean — no premium
    const rows = calcMealRestPremium([a, b, c]);
    const r = totalPremium(rows);
    expect(r.totalDays).toBe(2);
    expect(r.totalHours).toBe(2);
    expect(r.totalCents).toBe(35_00 + 40_00);
  });
});
