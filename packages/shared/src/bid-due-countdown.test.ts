import { describe, expect, it } from 'vitest';
import { bidDueCountdown } from './bid-due-countdown';

const NOW = new Date('2026-04-25T12:00:00Z');

describe('bidDueCountdown', () => {
  it('returns none when due date is missing', () => {
    expect(bidDueCountdown(undefined, NOW).level).toBe('none');
    expect(bidDueCountdown(null, NOW).level).toBe('none');
    expect(bidDueCountdown('', NOW).level).toBe('none');
  });

  it('returns none when due date cannot be parsed', () => {
    expect(bidDueCountdown('not a date', NOW).level).toBe('none');
    expect(bidDueCountdown('TBD', NOW).level).toBe('none');
  });

  it('escalates urgency as the due date approaches', () => {
    // 14 days out → green
    expect(bidDueCountdown('2026-05-09T12:00:00Z', NOW).level).toBe('green');
    // 5 days out → yellow
    expect(bidDueCountdown('2026-04-30T12:00:00Z', NOW).level).toBe('yellow');
    // 18 hours out → orange
    expect(bidDueCountdown('2026-04-26T06:00:00Z', NOW).level).toBe('orange');
    // 2 hours out → red
    expect(bidDueCountdown('2026-04-25T14:00:00Z', NOW).level).toBe('red');
  });

  it('flags overdue bids as red with OVERDUE label', () => {
    const c = bidDueCountdown('2026-04-24T12:00:00Z', NOW);
    expect(c.level).toBe('red');
    expect(c.shortLabel).toBe('OVERDUE');
    expect(c.deltaMs).toBeLessThan(0);
  });

  it('produces a human short label like "3d 4h" when days remain', () => {
    const c = bidDueCountdown('2026-04-28T16:00:00Z', NOW);
    expect(c.shortLabel).toBe('3d 4h');
  });

  it('produces a human short label like "2h 30m" when only hours remain', () => {
    const c = bidDueCountdown('2026-04-25T14:30:00Z', NOW);
    expect(c.shortLabel).toBe('2h 30m');
  });

  it('produces a human short label like "45m" when sub-hour', () => {
    const c = bidDueCountdown('2026-04-25T12:45:00Z', NOW);
    expect(c.shortLabel).toBe('45m');
  });

  it('flags date-only inputs (no time) so UI can nudge for a time', () => {
    const dateOnly = bidDueCountdown('April 30, 2026', NOW);
    expect(dateOnly.parsedFromTextOnly).toBe(true);
    const dateAndTime = bidDueCountdown('April 30, 2026 2:00 PM', NOW);
    expect(dateAndTime.parsedFromTextOnly).toBe(false);
  });

  it('produces a long label suitable for tooltips', () => {
    const c = bidDueCountdown('2026-04-28T16:00:00Z', NOW);
    expect(c.longLabel).toBe('Bid due in 3 days, 4 hours');
  });
});
