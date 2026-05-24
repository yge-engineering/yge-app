// Coverage for the upcoming-bid calendar builder.

import { describe, it, expect } from 'vitest';
import { buildUpcomingBidCalendar } from './upcoming-bids';

describe('buildUpcomingBidCalendar', () => {
  it('returns an empty calendar for no bids', () => {
    const c = buildUpcomingBidCalendar({ bids: [], asOfDate: '2026-05-22' });
    expect(c.rows).toEqual([]);
    expect(c.weeks).toEqual([]);
    expect(c.counts.total).toBe(0);
  });

  it('drops past bids by default', () => {
    const c = buildUpcomingBidCalendar({
      bids: [
        { id: 'a', projectName: 'Past', bidDueDate: '2026-05-15' },
        { id: 'b', projectName: 'Future', bidDueDate: '2026-05-29' },
      ],
      asOfDate: '2026-05-22',
    });
    expect(c.rows).toHaveLength(1);
    expect(c.rows[0]!.id).toBe('b');
  });

  it('keeps past bids when dropPast=false', () => {
    const c = buildUpcomingBidCalendar({
      bids: [
        { id: 'a', projectName: 'Past', bidDueDate: '2026-05-15' },
        { id: 'b', projectName: 'Future', bidDueDate: '2026-05-29' },
      ],
      asOfDate: '2026-05-22',
      dropPast: false,
    });
    expect(c.rows).toHaveLength(2);
    expect(c.rows[0]!.daysUntilDue).toBe(-7);
  });

  it('flags same-day conflicts in BOTH rows', () => {
    const c = buildUpcomingBidCalendar({
      bids: [
        { id: 'a', projectName: 'Caltrans hwy 36', bidDueDate: '2026-06-15' },
        { id: 'b', projectName: 'Shasta County PW', bidDueDate: '2026-06-15' },
        { id: 'c', projectName: 'CAL FIRE FFR', bidDueDate: '2026-06-22' },
      ],
      asOfDate: '2026-06-01',
    });
    const conflicts = c.rows.filter((r) => r.sameDayConflict);
    expect(conflicts).toHaveLength(2);
    expect(conflicts.map((r) => r.id).sort()).toEqual(['a', 'b']);
    expect(c.counts.sameDayConflictCount).toBe(2);
  });

  it('flags a Memorial Day due date as non-business-day', () => {
    const c = buildUpcomingBidCalendar({
      bids: [
        // Memorial Day Mon 2026-05-25 (CA observed)
        { id: 'a', projectName: 'Caltrans test', bidDueDate: '2026-05-25' },
      ],
      asOfDate: '2026-05-18',
    });
    expect(c.rows[0]!.fallsOnNonBusinessDay).toBe(true);
    expect(c.counts.nonBusinessDayCount).toBe(1);
  });

  it('groups bids into ISO weeks (Mon-Sun) sorted chronologically', () => {
    const c = buildUpcomingBidCalendar({
      bids: [
        // Week of 2026-06-01 → Mon 6/1, Sun 6/7
        { id: 'a', projectName: 'X', bidDueDate: '2026-06-03' },
        // Week of 2026-06-08 → Mon 6/8, Sun 6/14
        { id: 'b', projectName: 'Y', bidDueDate: '2026-06-10' },
        // Same week as a
        { id: 'c', projectName: 'Z', bidDueDate: '2026-06-05' },
      ],
      asOfDate: '2026-06-01',
    });
    expect(c.weeks).toHaveLength(2);
    expect(c.weeks[0]!.weekStart).toBe('2026-06-01');
    expect(c.weeks[0]!.weekEnd).toBe('2026-06-07');
    expect(c.weeks[0]!.rows.map((r) => r.id).sort()).toEqual(['a', 'c']);
    expect(c.weeks[1]!.weekStart).toBe('2026-06-08');
  });

  it('handles a Sunday bid by bucketing it with the prior Monday', () => {
    // Sun 2026-06-07 belongs to the week of Mon 2026-06-01.
    const c = buildUpcomingBidCalendar({
      bids: [{ id: 's', projectName: 'Sun bid', bidDueDate: '2026-06-07' }],
      asOfDate: '2026-06-01',
    });
    expect(c.weeks[0]!.weekStart).toBe('2026-06-01');
  });

  it('nextSevenDays count excludes bids past day 7', () => {
    const c = buildUpcomingBidCalendar({
      bids: [
        { id: 'today', projectName: 'A', bidDueDate: '2026-05-22' },
        { id: 'day3', projectName: 'B', bidDueDate: '2026-05-25' },
        { id: 'day7', projectName: 'C', bidDueDate: '2026-05-29' },
        { id: 'day8', projectName: 'D', bidDueDate: '2026-05-30' },
      ],
      asOfDate: '2026-05-22',
    });
    expect(c.counts.nextSevenDays).toBe(3);
  });
});
