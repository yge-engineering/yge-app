import { describe, it, expect } from 'vitest';
import {
  evaluateShift,
  requiredRestBreaks,
  isSecondMealWaivable,
  shouldBlockSubmit,
  hhmmToMinutes,
  type ShiftInput,
} from './ca-shift-rules';

const m = (h: number, mn: number) => h * 60 + mn;

describe('requiredRestBreaks', () => {
  it('returns 0 for short shifts', () => {
    expect(requiredRestBreaks(0)).toBe(0);
    expect(requiredRestBreaks(3.4)).toBe(0);
  });
  it('returns 1 for 3.5–6h shifts', () => {
    expect(requiredRestBreaks(3.5)).toBe(1);
    expect(requiredRestBreaks(5)).toBe(1);
    expect(requiredRestBreaks(6)).toBe(1);
  });
  it('returns 2 for 6.01–10h shifts', () => {
    expect(requiredRestBreaks(6.5)).toBe(2);
    expect(requiredRestBreaks(8)).toBe(2);
    expect(requiredRestBreaks(10)).toBe(2);
  });
  it('returns 3 for 10.01–14h shifts', () => {
    expect(requiredRestBreaks(10.5)).toBe(3);
    expect(requiredRestBreaks(14)).toBe(3);
  });
  it('returns 4 for shifts beyond 14h', () => {
    expect(requiredRestBreaks(14.5)).toBe(4);
    expect(requiredRestBreaks(20)).toBe(4);
  });
});

describe('isSecondMealWaivable', () => {
  it('waivable when ≤12 h and first meal taken', () => {
    expect(isSecondMealWaivable(11, true)).toBe(true);
    expect(isSecondMealWaivable(12, true)).toBe(true);
  });
  it('not waivable past 12 h even with first meal', () => {
    expect(isSecondMealWaivable(12.5, true)).toBe(false);
  });
  it('not waivable when first meal missed', () => {
    expect(isSecondMealWaivable(11, false)).toBe(false);
  });
});

describe('evaluateShift — happy paths', () => {
  it('8-hour shift with proper meal + 2 rest breaks → no violations', () => {
    const input: ShiftInput = {
      clockInMin: m(7, 0),
      clockOutMin: m(15, 30),
      meals: [{ startMin: m(11, 30), endMin: m(12, 0) }],
      rests: [
        { startMin: m(9, 0), endMin: m(9, 10) },
        { startMin: m(13, 30), endMin: m(13, 40) },
      ],
    };
    expect(evaluateShift(input)).toEqual([]);
  });

  it('4-hour shift with 1 rest, no meal → no violations (shift ≤ 5h)', () => {
    const input: ShiftInput = {
      clockInMin: m(8, 0),
      clockOutMin: m(12, 0),
      meals: [],
      rests: [{ startMin: m(10, 0), endMin: m(10, 10) }],
    };
    expect(evaluateShift(input)).toEqual([]);
  });
});

describe('evaluateShift — meal periods', () => {
  it('flags missing meal when shift > 5h', () => {
    const v = evaluateShift({
      clockInMin: m(8, 0),
      clockOutMin: m(14, 0),
      meals: [],
      rests: [
        { startMin: m(10, 0), endMin: m(10, 10) },
        { startMin: m(12, 30), endMin: m(12, 40) },
      ],
    });
    expect(v.some((x) => x.code === 'NO_MEAL_PERIOD')).toBe(true);
  });

  it('flags short first meal', () => {
    const v = evaluateShift({
      clockInMin: m(7, 0),
      clockOutMin: m(15, 30),
      meals: [{ startMin: m(11, 30), endMin: m(11, 50) }], // 20 min, too short
      rests: [
        { startMin: m(9, 0), endMin: m(9, 10) },
        { startMin: m(13, 30), endMin: m(13, 40) },
      ],
    });
    expect(v.some((x) => x.code === 'SHORT_FIRST_MEAL')).toBe(true);
  });

  it('flags late first meal (after end of 5th hour)', () => {
    const v = evaluateShift({
      clockInMin: m(7, 0),
      clockOutMin: m(15, 30),
      meals: [{ startMin: m(12, 30), endMin: m(13, 0) }], // > 7:00 + 5h = 12:00
      rests: [
        { startMin: m(9, 0), endMin: m(9, 10) },
        { startMin: m(14, 0), endMin: m(14, 10) },
      ],
    });
    expect(v.some((x) => x.code === 'LATE_FIRST_MEAL')).toBe(true);
  });

  it('requires second meal when shift > 10h and not waivable', () => {
    const v = evaluateShift({
      clockInMin: m(6, 0),
      clockOutMin: m(19, 0), // 13h — not waivable
      meals: [{ startMin: m(10, 0), endMin: m(10, 30) }],
      rests: [
        { startMin: m(8, 0), endMin: m(8, 10) },
        { startMin: m(13, 0), endMin: m(13, 10) },
        { startMin: m(16, 0), endMin: m(16, 10) },
      ],
    });
    expect(v.some((x) => x.code === 'NO_SECOND_MEAL')).toBe(true);
  });

  it('waives second meal when shift ≤ 12h and first meal taken', () => {
    const v = evaluateShift({
      clockInMin: m(6, 0),
      clockOutMin: m(17, 0), // 11h, waivable
      meals: [{ startMin: m(10, 0), endMin: m(10, 30) }],
      rests: [
        { startMin: m(8, 0), endMin: m(8, 10) },
        { startMin: m(13, 30), endMin: m(13, 40) },
        { startMin: m(15, 30), endMin: m(15, 40) },
      ],
    });
    expect(v.some((x) => x.code === 'NO_SECOND_MEAL')).toBe(false);
  });
});

describe('evaluateShift — rest breaks', () => {
  it('flags missing rest break on 5-hour shift', () => {
    const v = evaluateShift({
      clockInMin: m(8, 0),
      clockOutMin: m(13, 0), // 5 h shift
      meals: [],
      rests: [],
    });
    expect(v.some((x) => x.code === 'MISSING_REST_BREAK')).toBe(true);
  });

  it('flags missing breaks on 8-hour shift with only 1 break', () => {
    const v = evaluateShift({
      clockInMin: m(7, 0),
      clockOutMin: m(15, 30),
      meals: [{ startMin: m(11, 30), endMin: m(12, 0) }],
      rests: [{ startMin: m(9, 0), endMin: m(9, 10) }], // 2 expected
    });
    expect(v.some((x) => x.code === 'MISSING_REST_BREAK')).toBe(true);
  });
});

describe('evaluateShift — shift length', () => {
  it('LONG_SHIFT (warn-only) for 13h', () => {
    const v = evaluateShift({
      clockInMin: m(6, 0),
      clockOutMin: m(19, 0),
      meals: [
        { startMin: m(10, 0), endMin: m(10, 30) },
        { startMin: m(15, 0), endMin: m(15, 30) },
      ],
      rests: [
        { startMin: m(8, 0), endMin: m(8, 10) },
        { startMin: m(13, 0), endMin: m(13, 10) },
        { startMin: m(17, 0), endMin: m(17, 10) },
      ],
    });
    const ls = v.find((x) => x.code === 'LONG_SHIFT');
    expect(ls).toBeDefined();
    expect(ls?.blocking).toBe(false);
  });

  it('EXCESSIVE_SHIFT (blocking) for 17h', () => {
    const v = evaluateShift({
      clockInMin: m(5, 0),
      clockOutMin: m(22, 0), // 17h
      meals: [
        { startMin: m(9, 0), endMin: m(9, 30) },
        { startMin: m(14, 0), endMin: m(14, 30) },
      ],
      rests: [
        { startMin: m(7, 0), endMin: m(7, 10) },
        { startMin: m(11, 0), endMin: m(11, 10) },
        { startMin: m(16, 0), endMin: m(16, 10) },
        { startMin: m(19, 0), endMin: m(19, 10) },
      ],
    });
    const ex = v.find((x) => x.code === 'EXCESSIVE_SHIFT');
    expect(ex).toBeDefined();
    expect(ex?.blocking).toBe(true);
  });
});

describe('evaluateShift — invalid input', () => {
  it('flags clock-out before clock-in', () => {
    const v = evaluateShift({
      clockInMin: m(8, 0),
      clockOutMin: m(7, 0),
      meals: [],
      rests: [],
    });
    expect(v.length).toBe(1);
    expect(v[0]?.code).toBe('INVALID_TIMES');
  });
});

describe('shouldBlockSubmit', () => {
  it('returns true when any blocking violation present', () => {
    expect(
      shouldBlockSubmit([
        { code: 'NO_MEAL_PERIOD', message: '', blocking: true },
        { code: 'LONG_SHIFT', message: '', blocking: false },
      ]),
    ).toBe(true);
  });
  it('returns false when only warn-only violations', () => {
    expect(
      shouldBlockSubmit([{ code: 'LONG_SHIFT', message: '', blocking: false }]),
    ).toBe(false);
  });
  it('returns false for empty', () => {
    expect(shouldBlockSubmit([])).toBe(false);
  });
});

describe('hhmmToMinutes', () => {
  it('parses standard HH:MM', () => {
    expect(hhmmToMinutes('07:30')).toBe(450);
    expect(hhmmToMinutes('00:00')).toBe(0);
    expect(hhmmToMinutes('23:59')).toBe(23 * 60 + 59);
  });
  it('parses single-digit hour', () => {
    expect(hhmmToMinutes('7:30')).toBe(450);
  });
  it('rejects bad input', () => {
    expect(hhmmToMinutes('7:60')).toBeNull();
    expect(hhmmToMinutes('25:00')).toBeNull();
    expect(hhmmToMinutes('not a time')).toBeNull();
    expect(hhmmToMinutes('')).toBeNull();
  });
});
