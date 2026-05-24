// Coverage for per-job billing-pace tracker.

import { describe, it, expect } from 'vitest';
import { computeBillingPace } from './job-billing-pace';

const base = {
  contractTotalCents: 1_200_000_00, // $1.2M
  noticeToProceedDate: '2026-04-01',
  plannedEndDate: '2026-09-30', // 182 days
};

describe('computeBillingPace', () => {
  it('NOT_STARTED when as-of is before NTP', () => {
    const r = computeBillingPace({
      ...base,
      revenueBilledCents: 0,
      asOfDate: '2026-03-15',
    });
    expect(r.status).toBe('NOT_STARTED');
  });

  it('NOT_STARTED when planned end is at or before NTP', () => {
    const r = computeBillingPace({
      ...base,
      plannedEndDate: '2026-04-01',
      revenueBilledCents: 0,
      asOfDate: '2026-04-15',
    });
    expect(r.status).toBe('NOT_STARTED');
  });

  it('ON_TRACK when billed % ≈ elapsed %', () => {
    // Half-way through 182-day job → expect 50% billed = $600K. We
    // bill $620K (within ±5%): on track.
    const r = computeBillingPace({
      ...base,
      revenueBilledCents: 620_000_00,
      asOfDate: '2026-07-01', // 91 days in = 50% elapsed
    });
    expect(r.status).toBe('ON_TRACK');
    expect(r.elapsedFraction).toBeCloseTo(0.5, 1);
  });

  it('BEHIND when billed % is meaningfully under elapsed %', () => {
    // Half-way through, only $300K billed of $1.2M = 25%. -25% gap.
    const r = computeBillingPace({
      ...base,
      revenueBilledCents: 300_000_00,
      asOfDate: '2026-07-01',
    });
    expect(r.status).toBe('BEHIND');
    expect(r.varianceCents).toBeLessThan(0);
    expect(r.note).toContain('Behind');
  });

  it('AHEAD when billed % is meaningfully over elapsed %', () => {
    // Half-way through, $900K billed (75%): well ahead. Field
    // verification recommended.
    const r = computeBillingPace({
      ...base,
      revenueBilledCents: 900_000_00,
      asOfDate: '2026-07-01',
    });
    expect(r.status).toBe('AHEAD');
    expect(r.varianceCents).toBeGreaterThan(0);
  });

  it('COMPLETE when past planned end + 95%+ billed', () => {
    const r = computeBillingPace({
      ...base,
      revenueBilledCents: 1_200_000_00, // 100%
      asOfDate: '2026-10-15', // past planned end
    });
    expect(r.status).toBe('COMPLETE');
    expect(r.note).toContain('close out');
  });

  it('past planned end but only 80% billed → BEHIND, not COMPLETE', () => {
    const r = computeBillingPace({
      ...base,
      revenueBilledCents: 960_000_00, // 80%
      asOfDate: '2026-10-15',
    });
    // Past end → elapsedFraction caps at 1.0. billedFraction 0.8 vs
    // 1.0 → deviation -0.2 → BEHIND.
    expect(r.status).toBe('BEHIND');
  });

  it('handles a $0 contract gracefully', () => {
    const r = computeBillingPace({
      contractTotalCents: 0,
      noticeToProceedDate: '2026-04-01',
      plannedEndDate: '2026-09-30',
      revenueBilledCents: 0,
      asOfDate: '2026-07-01',
    });
    // billedFraction = 0, expected = 0 → on-track (technically) at
    // 50% elapsed with deviation = -0.5. But the 0 contract means
    // expected and actual are both 0, deviation is -elapsedFraction
    // = -0.5 → BEHIND. Fine.
    expect(['BEHIND', 'ON_TRACK']).toContain(r.status);
  });
});
