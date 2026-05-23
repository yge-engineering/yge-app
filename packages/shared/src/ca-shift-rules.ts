// California break / meal / shift-length rule engine.
//
// What it enforces (per California Labor Code + IWC Wage Orders):
//
//   - Meal period 1: required when a shift exceeds 5 hours; minimum 30 min;
//     must start before the END of the 5th hour of work.
//   - Meal period 2: required when a shift exceeds 10 hours, UNLESS the
//     shift is no more than 12 hours AND the first meal period was taken.
//   - Rest breaks: 10 minutes per 4 hours worked or major fraction thereof.
//     3.5–6 h = 1; 6–10 h = 2; 10–14 h = 3; 14+ = 4.
//   - Shift length: 12 h prompts "are you sure"; > 16 h requires an explicit
//     supervisor override + typed reason.
//
// All times are minutes-since-midnight (a number) so the helper has no time-
// zone surprises. Callers convert their HH:MM / Date times to minutes before
// calling.

import { z } from 'zod';

export const ShiftPeriodSchema = z.object({
  /** Start of the meal / rest period, minutes since midnight. */
  startMin: z.number().int().min(0).max(60 * 48),
  /** End of the period, must be > startMin. */
  endMin: z.number().int().min(0).max(60 * 48),
});
export type ShiftPeriod = z.infer<typeof ShiftPeriodSchema>;

export const ShiftInputSchema = z.object({
  clockInMin: z.number().int().min(0).max(60 * 48),
  clockOutMin: z.number().int().min(0).max(60 * 48),
  meals: z.array(ShiftPeriodSchema).default([]),
  rests: z.array(ShiftPeriodSchema).default([]),
});
export type ShiftInput = z.infer<typeof ShiftInputSchema>;

export const ShiftViolationCodeSchema = z.enum([
  'NO_MEAL_PERIOD',
  'SHORT_FIRST_MEAL',
  'LATE_FIRST_MEAL',
  'NO_SECOND_MEAL',
  'SHORT_SECOND_MEAL',
  'MISSING_REST_BREAK',
  'LONG_SHIFT',
  'EXCESSIVE_SHIFT',
  'INVALID_TIMES',
]);
export type ShiftViolationCode = z.infer<typeof ShiftViolationCodeSchema>;

export interface ShiftViolation {
  code: ShiftViolationCode;
  message: string;
  /** True when this should BLOCK submit (vs warn-only). */
  blocking: boolean;
}

const FIFTH_HOUR_END_MIN = 5 * 60;

/** Number of 10-min rest breaks required for a shift of `hours` length. */
export function requiredRestBreaks(shiftHours: number): number {
  if (shiftHours < 3.5) return 0;
  if (shiftHours <= 6) return 1;
  if (shiftHours <= 10) return 2;
  if (shiftHours <= 14) return 3;
  return 4;
}

/** True if a second meal can be waived: shift ≤ 12 h AND first meal taken. */
export function isSecondMealWaivable(shiftHours: number, firstMealTaken: boolean): boolean {
  return shiftHours <= 12 && firstMealTaken;
}

/** Pure evaluator — returns every violation found, ordered roughly by
 *  significance (meal/rest first, then shift length). */
export function evaluateShift(input: ShiftInput): ShiftViolation[] {
  const out: ShiftViolation[] = [];
  const shiftMin = input.clockOutMin - input.clockInMin;

  if (shiftMin <= 0) {
    out.push({
      code: 'INVALID_TIMES',
      message: 'Clock-out must be after clock-in.',
      blocking: true,
    });
    return out;
  }
  const shiftHours = shiftMin / 60;

  // Meal 1
  if (shiftHours > 5) {
    if (input.meals.length === 0) {
      out.push({
        code: 'NO_MEAL_PERIOD',
        message: 'A 30-minute unpaid meal period is required for shifts over 5 hours.',
        blocking: true,
      });
    } else {
      const meal1 = input.meals[0];
      if (meal1) {
        const duration = meal1.endMin - meal1.startMin;
        if (duration < 30) {
          out.push({
            code: 'SHORT_FIRST_MEAL',
            message: `First meal period was only ${duration} minutes (30 required).`,
            blocking: true,
          });
        }
        // Must start by the END of the 5th hour, measured from clock-in.
        const latestAllowedStart = input.clockInMin + FIFTH_HOUR_END_MIN;
        if (meal1.startMin > latestAllowedStart) {
          out.push({
            code: 'LATE_FIRST_MEAL',
            message: 'First meal period started after the end of the 5th hour.',
            blocking: true,
          });
        }
      }
    }
  }

  // Meal 2
  if (shiftHours > 10) {
    const firstMealTaken = input.meals.length >= 1;
    const waivable = isSecondMealWaivable(shiftHours, firstMealTaken);
    if (!waivable && input.meals.length < 2) {
      out.push({
        code: 'NO_SECOND_MEAL',
        message:
          'A second meal period is required for shifts over 10 hours (unless the shift is 12 hours or less and the first meal was taken).',
        blocking: true,
      });
    }
    const meal2 = input.meals[1];
    if (meal2) {
      const duration = meal2.endMin - meal2.startMin;
      if (duration < 30) {
        out.push({
          code: 'SHORT_SECOND_MEAL',
          message: `Second meal period was only ${duration} minutes (30 required).`,
          blocking: true,
        });
      }
    }
  }

  // Rest breaks
  const expected = requiredRestBreaks(shiftHours);
  if (input.rests.length < expected) {
    const missing = expected - input.rests.length;
    out.push({
      code: 'MISSING_REST_BREAK',
      message: `Missing ${missing} rest break${missing === 1 ? '' : 's'} (${expected} expected for a ${shiftHours.toFixed(1)}-hour shift).`,
      blocking: true,
    });
  }

  // Shift length
  if (shiftHours > 16) {
    out.push({
      code: 'EXCESSIVE_SHIFT',
      message: `Shift over 16 hours (${shiftHours.toFixed(1)} h) requires an explicit supervisor override with a typed reason.`,
      blocking: true,
    });
  } else if (shiftHours > 12) {
    out.push({
      code: 'LONG_SHIFT',
      message: `Shift over 12 hours (${shiftHours.toFixed(1)} h) — confirm intentional.`,
      blocking: false,
    });
  }

  return out;
}

/** True if any violation should block a submit (vs warn-only). */
export function shouldBlockSubmit(violations: ShiftViolation[]): boolean {
  return violations.some((v) => v.blocking);
}

/** Convert HH:MM string to minutes since midnight. Returns null on bad input. */
export function hhmmToMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = parseInt(m[1] ?? '0', 10);
  const mn = parseInt(m[2] ?? '0', 10);
  if (h < 0 || h >= 24 || mn < 0 || mn >= 60) return null;
  return h * 60 + mn;
}
