// Holidays + business-day math.
//
// Picks specific years to lock floating holidays (MLK 3rd Mon Jan,
// Memorial last Mon May, etc.), tests Saturday/Sunday shift rule for
// fixed-date holidays, and covers DAS-140-style 5-business-day math
// across a Christmas span.

import { describe, it, expect } from 'vitest';
import {
  californiaHolidays,
  californiaHolidaySet,
  isBusinessDay,
  addDays,
  addBusinessDays,
  subtractBusinessDays,
  nextBusinessDay,
  businessDaysBetween,
} from './california-holidays';

describe('californiaHolidays', () => {
  it('returns all observed dates sorted (2026)', () => {
    const dates = californiaHolidays(2026).map((h) => h.date);
    // 2026 sanity-spot-check anchors:
    // 1/1 Thu — observed New Year
    // 1/19 Mon — MLK Day (3rd Mon)
    // 2/16 Mon — Presidents' Day (3rd Mon)
    // 3/31 Tue — Cesar Chavez (CA state)
    // 5/25 Mon — Memorial Day (last Mon May 2026)
    // 6/19 Fri — Juneteenth
    // 7/4 Sat → observed 7/3 Fri
    // 9/7 Mon — Labor Day (1st Mon Sept)
    // 11/11 Wed — Veterans Day
    // 11/26 Thu — Thanksgiving (4th Thu Nov)
    // 11/27 Fri — Day after Thanksgiving (CA)
    // 12/25 Fri — Christmas Day
    expect(dates).toContain('2026-01-01');
    expect(dates).toContain('2026-01-19');
    expect(dates).toContain('2026-02-16');
    expect(dates).toContain('2026-03-31');
    expect(dates).toContain('2026-05-25');
    expect(dates).toContain('2026-06-19');
    expect(dates).toContain('2026-07-03'); // observed
    expect(dates).toContain('2026-09-07');
    expect(dates).toContain('2026-11-11');
    expect(dates).toContain('2026-11-26');
    expect(dates).toContain('2026-11-27');
    expect(dates).toContain('2026-12-25');
    // monotonically sorted
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);
  });

  it('shifts a Sunday fixed date to Monday observed', () => {
    // 2023-01-01 was a Sunday → New Year's observed Mon 1/2.
    const set = californiaHolidaySet(2023);
    expect(set.has('2023-01-02')).toBe(true);
    expect(set.has('2023-01-01')).toBe(false);
  });

  it('shifts a Saturday fixed date to Friday observed', () => {
    // 2022-12-25 was a Sunday → Christmas observed Mon 12/26 (not in
    // the 2023 set, but verifies the Sunday→Mon rule).
    // 2027-12-25 is a Saturday → observed Fri 12/24.
    const set = californiaHolidaySet(2027);
    expect(set.has('2027-12-24')).toBe(true);
    expect(set.has('2027-12-25')).toBe(false);
  });

  it('opt-in includes YGE year-end closure days', () => {
    const withYge = californiaHolidays(2026, { includeYgeClosures: true });
    const ygeDays = withYge.filter((h) => h.kind === 'yge').map((h) => h.date);
    // 12/24 Thu, 12/28 Mon, 12/29 Tue, 12/30 Wed, 12/31 Thu in 2026.
    // (12/25 is the fixed Christmas, 12/26 Sat, 12/27 Sun.)
    expect(ygeDays).toContain('2026-12-24');
    expect(ygeDays).toContain('2026-12-28');
    expect(ygeDays).toContain('2026-12-29');
    expect(ygeDays).toContain('2026-12-30');
    expect(ygeDays).toContain('2026-12-31');
    // The default (no YGE) returns no YGE entries.
    expect(californiaHolidays(2026).every((h) => h.kind !== 'yge')).toBe(true);
  });
});

describe('isBusinessDay', () => {
  it('rejects Saturday + Sunday', () => {
    expect(isBusinessDay('2026-05-23')).toBe(false); // Sat
    expect(isBusinessDay('2026-05-24')).toBe(false); // Sun
  });
  it('rejects observed holidays', () => {
    expect(isBusinessDay('2026-07-03')).toBe(false); // Fri observed July 4
  });
  it('accepts a regular weekday', () => {
    expect(isBusinessDay('2026-05-26')).toBe(true); // Tue (Mem Day was 5/25)
  });
  it('default ignores YGE closures (external-deadline math)', () => {
    expect(isBusinessDay('2026-12-24')).toBe(true);
    expect(isBusinessDay('2026-12-24', { includeYgeClosures: true })).toBe(false);
  });
});

describe('addBusinessDays', () => {
  it('counts the next 5 business days, skipping weekends', () => {
    // Mon 2026-05-18 + 5 business days = Mon 2026-05-25... no wait,
    // that's Memorial Day. So skip → Tue 2026-05-26.
    expect(addBusinessDays('2026-05-18', 5)).toBe('2026-05-26');
  });
  it('returns the same day for count 0 if it is a business day', () => {
    expect(addBusinessDays('2026-05-18', 0)).toBe('2026-05-18');
  });
  it('snaps a weekend start forward then counts', () => {
    // Sat 2026-05-23 + 1 → first jump to Mon 2026-05-25 = Memorial Day
    // → next biz day Tue 2026-05-26, then +1 = Wed 2026-05-27.
    expect(addBusinessDays('2026-05-23', 1)).toBe('2026-05-27');
  });
  it('DAS-140 5-business-day rule across Christmas', () => {
    // Award notice 2026-12-22 (Tue). DAS-140 due 5 business days later.
    // 12/22 Tue start (count 0) → 12/23 Wed (1) → 12/24 Thu (2) →
    // 12/25 Fri = Christmas → 12/26 Sat → 12/27 Sun → 12/28 Mon (3) →
    // 12/29 Tue (4) → 12/30 Wed (5) → answer: 12/30.
    expect(addBusinessDays('2026-12-22', 5)).toBe('2026-12-30');
  });
  it('throws on negative count', () => {
    expect(() => addBusinessDays('2026-01-01', -1)).toThrow();
  });
});

describe('subtractBusinessDays', () => {
  it('subtracts 3 business days across a normal week', () => {
    // Fri 2026-05-22 - 3 biz days = Tue 2026-05-19.
    expect(subtractBusinessDays('2026-05-22', 3)).toBe('2026-05-19');
  });
  it('skips weekends when going backward', () => {
    // Mon 2026-05-18 - 1 = Fri 2026-05-15.
    expect(subtractBusinessDays('2026-05-18', 1)).toBe('2026-05-15');
  });
  it('skips Memorial Day going backward', () => {
    // Tue 2026-05-26 - 3 biz days. Mon 5/25 is Memorial Day → skip.
    // 5/26 (start, biz day) → 5/22 (Fri, day 1) → 5/21 (Thu, day 2) →
    // 5/20 (Wed, day 3) → answer 5/20.
    expect(subtractBusinessDays('2026-05-26', 3)).toBe('2026-05-20');
  });
  it('count 0 returns the input when it is a business day', () => {
    expect(subtractBusinessDays('2026-05-26', 0)).toBe('2026-05-26');
  });
  it('count 0 snaps backward from a weekend', () => {
    expect(subtractBusinessDays('2026-05-23', 0)).toBe('2026-05-22');
  });
  it('throws on negative count', () => {
    expect(() => subtractBusinessDays('2026-01-01', -1)).toThrow();
  });
});

describe('nextBusinessDay', () => {
  it('returns the input when it is a business day', () => {
    expect(nextBusinessDay('2026-05-26')).toBe('2026-05-26');
  });
  it('jumps over a weekend to Monday', () => {
    expect(nextBusinessDay('2026-05-23')).toBe('2026-05-26');
  });
  it('jumps over a holiday-on-weekday', () => {
    // 2026-07-03 is observed July 4. Asking for the next biz day on/after
    // 2026-07-03 returns 2026-07-06 (Mon).
    expect(nextBusinessDay('2026-07-03')).toBe('2026-07-06');
  });
});

describe('businessDaysBetween', () => {
  it('returns 0 when from === to', () => {
    expect(businessDaysBetween('2026-05-18', '2026-05-18')).toBe(0);
  });
  it('counts a normal Mon-Fri week', () => {
    expect(businessDaysBetween('2026-05-18', '2026-05-25')).toBe(5);
  });
  it('skips Memorial Day in the count', () => {
    // 2026-05-18 (Mon) → 2026-05-29 (Fri exclusive) = Mon-Fri week 1 (5),
    // then Mon 5/25 = Memorial Day (skipped), Tue/Wed/Thu (3) = 8.
    expect(businessDaysBetween('2026-05-18', '2026-05-29')).toBe(8);
  });
  it('throws when from > to', () => {
    expect(() => businessDaysBetween('2026-05-25', '2026-05-18')).toThrow();
  });
});

describe('addDays', () => {
  it('adds one day across a month boundary', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
  });
  it('handles leap-year Feb 29 (2028)', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
  });
});
