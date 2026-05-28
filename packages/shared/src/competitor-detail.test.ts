import { describe, it, expect } from 'vitest';

import { summarizeCompetitor } from './competitor-detail';
import type { BidResult } from './bid-result';

function makeResult(
  overrides: Partial<BidResult> & Pick<BidResult, 'id' | 'jobId' | 'bidOpenedAt' | 'bidders'>,
): BidResult {
  return {
    id: overrides.id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    jobId: overrides.jobId,
    bidOpenedAt: overrides.bidOpenedAt,
    bidders: overrides.bidders,
    outcome: overrides.outcome ?? 'TBD',
    awardedAt: overrides.awardedAt,
    bidTabulationUrl: overrides.bidTabulationUrl,
    engineersEstimateCents: overrides.engineersEstimateCents,
    notes: overrides.notes,
  };
}

describe('summarizeCompetitor', () => {
  it('returns zero counts when no matching bidder appears', () => {
    const r = makeResult({
      id: 'br1', jobId: 'j1', bidOpenedAt: '2026-01-15',
      bidders: [
        { bidderName: 'Acme Inc', amountCents: 1_000_000_00, isYge: false },
        { bidderName: 'YGE', amountCents: 1_100_000_00, isYge: true },
      ],
      outcome: 'WON_BY_OTHER',
    });
    const s = summarizeCompetitor('Ford Construction', [r]);
    expect(s.appearances).toBe(0);
    expect(s.wins).toBe(0);
    expect(s.headToHeadCount).toBe(0);
    expect(s.lastSeenAt).toBeNull();
  });

  it('counts a competitor appearance when name matches case-insensitively', () => {
    const r = makeResult({
      id: 'br1', jobId: 'j1', bidOpenedAt: '2026-01-15',
      bidders: [
        { bidderName: 'ford construction', amountCents: 1_000_000_00, isYge: false },
      ],
      outcome: 'WON_BY_OTHER',
    });
    const s = summarizeCompetitor('Ford Construction', [r]);
    expect(s.appearances).toBe(1);
    expect(s.lastSeenAt).toBe('2026-01-15');
  });

  it('records a win when competitor was the first bidder + outcome is WON_BY_OTHER', () => {
    const r = makeResult({
      id: 'br1', jobId: 'j1', bidOpenedAt: '2026-02-15',
      bidders: [
        { bidderName: 'Ford Construction', amountCents: 5_000_000_00, isYge: false },
        { bidderName: 'YGE', amountCents: 5_500_000_00, isYge: true },
      ],
      outcome: 'WON_BY_OTHER',
    });
    const s = summarizeCompetitor('Ford Construction', [r]);
    expect(s.wins).toBe(1);
    expect(s.totalWonCents).toBe(5_000_000_00);
    expect(s.biggestWinCents).toBe(5_000_000_00);
    expect(s.averageWinCents).toBe(5_000_000_00);
  });

  it('does NOT credit a win when competitor was lowest but outcome is NO_AWARD', () => {
    const r = makeResult({
      id: 'br1', jobId: 'j1', bidOpenedAt: '2026-02-15',
      bidders: [
        { bidderName: 'Ford Construction', amountCents: 5_000_000_00, isYge: false },
        { bidderName: 'YGE', amountCents: 5_500_000_00, isYge: true },
      ],
      outcome: 'NO_AWARD',
    });
    const s = summarizeCompetitor('Ford Construction', [r]);
    expect(s.wins).toBe(0);
    expect(s.totalWonCents).toBe(0);
  });

  it('captures head-to-head encounters with the right gap sign', () => {
    const r1 = makeResult({
      id: 'br1', jobId: 'j1', bidOpenedAt: '2026-01-15',
      bidders: [
        { bidderName: 'Ford Construction', amountCents: 1_000_000_00, isYge: false },
        { bidderName: 'YGE', amountCents: 1_100_000_00, isYge: true },
      ],
      outcome: 'WON_BY_OTHER',
    });
    const r2 = makeResult({
      id: 'br2', jobId: 'j2', bidOpenedAt: '2026-03-15',
      bidders: [
        { bidderName: 'YGE', amountCents: 2_000_000_00, isYge: true },
        { bidderName: 'Ford Construction', amountCents: 2_300_000_00, isYge: false },
      ],
      outcome: 'WON_BY_YGE',
    });
    const s = summarizeCompetitor('Ford Construction', [r1, r2]);
    expect(s.headToHeadCount).toBe(2);
    expect(s.headToHeadTheyWon).toBe(1);
    expect(s.headToHeadYgeWon).toBe(1);
    // median of [-100k$, +300k$] = 100_000_00
    expect(s.medianGapCents).toBe(100_000_00);
  });

  it('returns head-to-head sorted by bidOpenedAt desc (most recent first)', () => {
    const old = makeResult({
      id: 'br1', jobId: 'j1', bidOpenedAt: '2026-01-15',
      bidders: [
        { bidderName: 'Ford', amountCents: 100, isYge: false },
        { bidderName: 'YGE', amountCents: 120, isYge: true },
      ],
    });
    const newer = makeResult({
      id: 'br2', jobId: 'j2', bidOpenedAt: '2026-06-30',
      bidders: [
        { bidderName: 'Ford', amountCents: 200, isYge: false },
        { bidderName: 'YGE', amountCents: 240, isYge: true },
      ],
    });
    const s = summarizeCompetitor('Ford', [old, newer]);
    expect(s.headToHead.map((h) => h.bidOpenedAt)).toEqual([
      '2026-06-30',
      '2026-01-15',
    ]);
  });

  it('rolls per-agency appearances when an agency resolver is provided', () => {
    const resolver = (r: BidResult) => (r.jobId.startsWith('caltrans') ? 'Caltrans' : 'County');
    const r1 = makeResult({
      id: 'br1', jobId: 'caltrans-x', bidOpenedAt: '2026-01-15',
      bidders: [{ bidderName: 'Ford', amountCents: 1, isYge: false }],
      outcome: 'WON_BY_OTHER',
    });
    const r2 = makeResult({
      id: 'br2', jobId: 'caltrans-y', bidOpenedAt: '2026-02-15',
      bidders: [{ bidderName: 'Ford', amountCents: 2, isYge: false }],
      outcome: 'WON_BY_OTHER',
    });
    const r3 = makeResult({
      id: 'br3', jobId: 'shasta-z', bidOpenedAt: '2026-03-15',
      bidders: [{ bidderName: 'Ford', amountCents: 3, isYge: false }],
      outcome: 'WON_BY_OTHER',
    });
    const s = summarizeCompetitor('Ford', [r1, r2, r3], resolver);
    expect(s.byAgency).toEqual([
      { agency: 'Caltrans', appearances: 2, wins: 2 },
      { agency: 'County', appearances: 1, wins: 1 },
    ]);
  });

  it('lastSeenAt picks the latest bidOpenedAt across appearances', () => {
    const r1 = makeResult({
      id: 'br1', jobId: 'j1', bidOpenedAt: '2026-01-01',
      bidders: [{ bidderName: 'Ford', amountCents: 100, isYge: false }],
    });
    const r2 = makeResult({
      id: 'br2', jobId: 'j2', bidOpenedAt: '2026-04-15',
      bidders: [{ bidderName: 'Ford', amountCents: 200, isYge: false }],
    });
    const r3 = makeResult({
      id: 'br3', jobId: 'j3', bidOpenedAt: '2026-02-15',
      bidders: [{ bidderName: 'Ford', amountCents: 300, isYge: false }],
    });
    expect(summarizeCompetitor('Ford', [r1, r2, r3]).lastSeenAt).toBe('2026-04-15');
  });

  it('averageWinCents is 0 when competitor has no wins', () => {
    const r = makeResult({
      id: 'br1', jobId: 'j1', bidOpenedAt: '2026-01-15',
      bidders: [
        { bidderName: 'YGE', amountCents: 1_000_000_00, isYge: true },
        { bidderName: 'Ford', amountCents: 1_100_000_00, isYge: false },
      ],
      outcome: 'WON_BY_YGE',
    });
    const s = summarizeCompetitor('Ford', [r]);
    expect(s.wins).toBe(0);
    expect(s.averageWinCents).toBe(0);
    expect(s.biggestWinCents).toBe(0);
  });
});
