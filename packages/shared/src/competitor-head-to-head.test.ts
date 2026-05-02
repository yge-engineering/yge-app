import { describe, expect, it } from 'vitest';

import type { BidTab, BidTabBidder } from './bid-tab';
import { YGE_NORMALIZED_NAME_DEFAULT } from './bid-tab-link';
import { computeHeadToHead } from './competitor-head-to-head';

function bidder(over: Partial<BidTabBidder>): BidTabBidder {
  return {
    rank: 1,
    name: 'Acme',
    nameNormalized: 'acme',
    totalCents: 1_000_000_00,
    ...over,
  } as BidTabBidder;
}

function tab(over: Partial<BidTab>): BidTab {
  return {
    id: 'bidtab-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    scrapedAt: '2026-04-01T00:00:00.000Z',
    source: 'CALTRANS',
    agencyName: 'Caltrans',
    ownerType: 'STATE',
    projectName: 'Project',
    state: 'CA',
    bidOpenedAt: '2026-04-01',
    bidders: [],
    ...over,
  } as BidTab;
}

describe('computeHeadToHead', () => {
  it('returns zero events when YGE and competitor never co-bid', () => {
    const r = computeHeadToHead({
      tabs: [
        tab({
          bidders: [
            bidder({ rank: 1, name: 'YGE', nameNormalized: YGE_NORMALIZED_NAME_DEFAULT, totalCents: 100 }),
          ],
        }),
        tab({
          id: 'bidtab-2',
          bidOpenedAt: '2026-05-01',
          bidders: [
            bidder({ rank: 1, name: 'Granite', nameNormalized: 'granite', totalCents: 200 }),
          ],
        }),
      ],
      competitorNameNormalized: 'granite',
    });
    expect(r.events).toBe(0);
  });

  it('counts wins/losses and averages the dollar delta', () => {
    const r = computeHeadToHead({
      tabs: [
        // YGE lower (rank 1) and lower in dollars — won apparent low.
        tab({
          bidders: [
            bidder({ rank: 1, name: 'YGE', nameNormalized: YGE_NORMALIZED_NAME_DEFAULT, totalCents: 90, awardedTo: true }),
            bidder({ rank: 2, name: 'Granite', nameNormalized: 'granite', totalCents: 100 }),
          ],
        }),
        // Competitor lower in both.
        tab({
          id: 'bidtab-2',
          bidOpenedAt: '2026-05-01',
          bidders: [
            bidder({ rank: 1, name: 'Granite', nameNormalized: 'granite', totalCents: 100, awardedTo: true }),
            bidder({ rank: 2, name: 'YGE', nameNormalized: YGE_NORMALIZED_NAME_DEFAULT, totalCents: 110 }),
          ],
        }),
      ],
      competitorNameNormalized: 'granite',
    });
    expect(r.events).toBe(2);
    expect(r.ygeLowerCount).toBe(1);
    expect(r.competitorLowerCount).toBe(1);
    expect(r.ygeApparentLowCount).toBe(1);
    expect(r.competitorApparentLowCount).toBe(1);
    expect(r.ygeAwardedCount).toBe(1);
    expect(r.competitorAwardedCount).toBe(1);
    // Dollar delta: (90-100) + (110-100) = 0; avg = 0.
    expect(r.avgYgeMinusCompetitorCents).toBe(0);
    expect(r.firstSeenAt).toBe('2026-04-01');
    expect(r.lastSeenAt).toBe('2026-05-01');
  });

  it('refuses to compute YGE-vs-YGE', () => {
    const r = computeHeadToHead({
      tabs: [
        tab({
          bidders: [
            bidder({ rank: 1, name: 'YGE', nameNormalized: YGE_NORMALIZED_NAME_DEFAULT, totalCents: 100 }),
          ],
        }),
      ],
      competitorNameNormalized: YGE_NORMALIZED_NAME_DEFAULT,
    });
    expect(r.events).toBe(0);
  });

  it('honors a custom YGE override (multi-tenant)', () => {
    const r = computeHeadToHead({
      tabs: [
        tab({
          bidders: [
            bidder({ rank: 1, name: 'OurCo', nameNormalized: 'ourco', totalCents: 90 }),
            bidder({ rank: 2, name: 'Their', nameNormalized: 'their', totalCents: 100 }),
          ],
        }),
      ],
      competitorNameNormalized: 'their',
      ygeNormalizedName: 'ourco',
    });
    expect(r.events).toBe(1);
    expect(r.ygeLowerCount).toBe(1);
  });
});
