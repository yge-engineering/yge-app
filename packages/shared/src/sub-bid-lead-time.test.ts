// Coverage for the sub-bid lead-time helper.

import { describe, it, expect } from 'vitest';
import {
  buildSubBidLeadPlan,
  earliestSendByDate,
  daysUntilEarliestSend,
} from './sub-bid-lead-time';

describe('buildSubBidLeadPlan', () => {
  it('routine trades default to 7 business days back', () => {
    // Prime due Fri 2026-07-31. 7 biz days back (no holidays in span):
    // 7/31 (start, biz day) → 7/30 (1) → 7/29 (2) → 7/28 (3) →
    // 7/27 (4) → 7/24 Fri (5) → 7/23 Thu (6) → 7/22 Wed (7) → 2026-07-22.
    const plan = buildSubBidLeadPlan({
      primeBidDueDate: '2026-07-31',
      trades: [{ trade: 'TRUCKING' }],
    });
    expect(plan[0]!.sendByDate).toBe('2026-07-22');
    expect(plan[0]!.leadDays).toBe(7);
  });

  it('specialty trades default to 14 business days back', () => {
    const plan = buildSubBidLeadPlan({
      primeBidDueDate: '2026-07-31',
      trades: [{ trade: 'ELECTRICAL' }],
    });
    expect(plan[0]!.leadDays).toBe(14);
    // 14 biz days back from Fri 2026-07-31 (no holidays): Mon 2026-07-13.
    expect(plan[0]!.sendByDate).toBe('2026-07-13');
  });

  it('caller can override per-trade lead days', () => {
    const plan = buildSubBidLeadPlan({
      primeBidDueDate: '2026-07-31',
      trades: [{ trade: 'TRUCKING', leadDaysOverride: 3 }],
    });
    expect(plan[0]!.leadDays).toBe(3);
    // 3 biz days back from Fri 2026-07-31: Tue 2026-07-28.
    expect(plan[0]!.sendByDate).toBe('2026-07-28');
  });

  it('skips CA holidays in the math (Memorial Day span)', () => {
    // Prime due Mon 2026-06-01. 7 biz days back must skip Memorial
    // Day (Mon 2026-05-25). Walk: 6/1 (start) → 5/29 (1) → 5/28 (2)
    // → 5/27 (3) → 5/26 (4) → 5/22 Fri (5) → 5/21 (6) → 5/20 (7) →
    // 2026-05-20.
    const plan = buildSubBidLeadPlan({
      primeBidDueDate: '2026-06-01',
      trades: [{ trade: 'CONCRETE_FLATWORK' }],
    });
    expect(plan[0]!.sendByDate).toBe('2026-05-20');
  });

  it('returns a row for every input trade with the original metadata', () => {
    const plan = buildSubBidLeadPlan({
      primeBidDueDate: '2026-07-31',
      trades: [
        { trade: 'TRUCKING', label: 'End-dumps NorCal' },
        { trade: 'ELECTRICAL', label: 'NEMA service install' },
      ],
    });
    expect(plan).toHaveLength(2);
    expect(plan[0]!.label).toBe('End-dumps NorCal');
    expect(plan[1]!.label).toBe('NEMA service install');
  });
});

describe('earliestSendByDate', () => {
  it('returns undefined for an empty plan', () => {
    expect(earliestSendByDate([])).toBeUndefined();
  });
  it('picks the earliest send-by across trades', () => {
    const plan = buildSubBidLeadPlan({
      primeBidDueDate: '2026-07-31',
      trades: [
        { trade: 'TRUCKING' },        // 7 biz days back → 7/22
        { trade: 'ELECTRICAL' },      // 14 biz days back → 7/13
      ],
    });
    expect(earliestSendByDate(plan)).toBe('2026-07-13');
  });
});

describe('daysUntilEarliestSend', () => {
  it('returns positive count when today is before earliest send-by', () => {
    const plan = buildSubBidLeadPlan({
      primeBidDueDate: '2026-07-31',
      trades: [{ trade: 'TRUCKING' }], // 7/22 send-by
    });
    // Today 7/15. Business days from 7/15 to 7/22 (exclusive of start):
    // 7/16 7/17 7/20 7/21 7/22 = 5 biz days.
    expect(daysUntilEarliestSend(plan, '2026-07-15')).toBe(5);
  });

  it('returns 0 when today equals the earliest send-by', () => {
    const plan = buildSubBidLeadPlan({
      primeBidDueDate: '2026-07-31',
      trades: [{ trade: 'TRUCKING' }],
    });
    expect(daysUntilEarliestSend(plan, '2026-07-22')).toBe(0);
  });

  it('returns negative count when today is past earliest send-by', () => {
    const plan = buildSubBidLeadPlan({
      primeBidDueDate: '2026-07-31',
      trades: [{ trade: 'TRUCKING' }], // 7/22 send-by
    });
    // Today 7/24 = 2 biz days past 7/22 (7/22 → 7/23 (1) → 7/24 (2)).
    expect(daysUntilEarliestSend(plan, '2026-07-24')).toBe(-2);
  });

  it('snaps weekend today to next business day before counting', () => {
    const plan = buildSubBidLeadPlan({
      primeBidDueDate: '2026-07-31',
      trades: [{ trade: 'TRUCKING' }],
    });
    // Sat 2026-07-18 snaps to Mon 2026-07-20. 7/20 → 7/22 = 2 biz days.
    expect(daysUntilEarliestSend(plan, '2026-07-18')).toBe(2);
  });
});
