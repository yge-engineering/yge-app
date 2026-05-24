// Coverage for the bid-postponement detector. Mostly: prove the strong
// phrases fire, the date extractor handles the formats agencies use,
// and weak-only matches stay below the action threshold.

import { describe, it, expect } from 'vitest';
import { detectBidPostponement } from './bid-postponement-detect';

describe('detectBidPostponement', () => {
  it('detects "bid opening postponed" + an ISO date', () => {
    const r = detectBidPostponement({
      subject: 'Caltrans D2 03-1K2904 — Bid opening postponed',
      body: 'Bid opening has been moved to 2026-06-15 at 2:00 PM.',
    });
    expect(r.detected).toBe(true);
    expect(r.confidence).toBeGreaterThan(0.9);
    expect(r.newDate).toBe('2026-06-15');
    expect(r.matchedSignals).toContain('bid opening postponed');
  });

  it('detects "due date extended" + US-format date', () => {
    const r = detectBidPostponement({
      subject: 'Shasta County — Roadwork Project',
      body: 'The bid due date has been extended. New date 7/2/2026.',
    });
    expect(r.detected).toBe(true);
    expect(r.newDate).toBe('2026-07-02');
  });

  it('detects with a written-month date', () => {
    const r = detectBidPostponement({
      body: 'Bid opening rescheduled to June 15, 2026 per Addendum No. 3.',
    });
    expect(r.detected).toBe(true);
    expect(r.newDate).toBe('2026-06-15');
  });

  it('returns confidence 0.65 when only the phrase appears', () => {
    const r = detectBidPostponement({
      body: 'The bid opening date has been moved. Please review.',
    });
    expect(r.detected).toBe(true);
    expect(r.confidence).toBeGreaterThanOrEqual(0.6);
    expect(r.confidence).toBeLessThan(0.9);
    expect(r.newDate).toBeUndefined();
  });

  it('weak match WITHOUT a date stays below action threshold', () => {
    const r = detectBidPostponement({
      subject: 'Addendum no. 2 issued',
      body: 'Revised schedule attached.',
    });
    expect(r.detected).toBe(false);
    expect(r.confidence).toBeLessThan(0.5);
  });

  it('weak match WITH a date hits the action threshold', () => {
    const r = detectBidPostponement({
      subject: 'Addendum no. 2',
      body: 'Revised schedule — opening 6/15/2026.',
    });
    expect(r.detected).toBe(true);
    expect(r.confidence).toBeGreaterThanOrEqual(0.5);
    expect(r.newDate).toBe('2026-06-15');
  });

  it('returns undetected when neither subject nor body has the language', () => {
    const r = detectBidPostponement({
      subject: 'Just confirming the meeting tomorrow',
      body: 'See attached agenda.',
    });
    expect(r.detected).toBe(false);
    expect(r.confidence).toBe(0);
    expect(r.matchedSignals).toEqual([]);
  });

  it('handles missing inputs gracefully', () => {
    const r = detectBidPostponement({});
    expect(r.detected).toBe(false);
    expect(r.confidence).toBe(0);
  });
});
