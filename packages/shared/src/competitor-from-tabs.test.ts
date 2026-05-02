import { describe, expect, it } from 'vitest';

import type { BidTab, BidTabBidder } from './bid-tab';
import { buildCompetitorProfilesFromTabs } from './competitor-from-tabs';

function bidder(over: Partial<BidTabBidder>): BidTabBidder {
  return {
    rank: 1,
    name: 'Granite Construction Inc.',
    nameNormalized: 'granite',
    totalCents: 4_000_000_00,
    ...over,
  } as BidTabBidder;
}

function tab(over: Partial<BidTab>): BidTab {
  return {
    id: 'bidtab-00000001',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    scrapedAt: '2026-04-01T00:00:00.000Z',
    source: 'CALTRANS',
    agencyName: 'Caltrans D2',
    ownerType: 'STATE',
    projectName: 'Project A',
    state: 'CA',
    bidOpenedAt: '2026-04-01',
    bidders: [],
    ...over,
  } as BidTab;
}

describe('buildCompetitorProfilesFromTabs', () => {
  it('rolls up appearances + apparent-low + agencies + counties', () => {
    const r = buildCompetitorProfilesFromTabs([
      tab({
        county: 'Trinity',
        bidders: [
          bidder({ rank: 1, name: 'Granite', nameNormalized: 'granite', totalCents: 100_000_00 }),
          bidder({ rank: 2, name: 'Knife River', nameNormalized: 'knife river', totalCents: 110_000_00 }),
        ],
      }),
      tab({
        id: 'bidtab-00000002',
        agencyName: 'Caltrans D2',
        county: 'Shasta',
        bidOpenedAt: '2026-05-01',
        bidders: [
          bidder({ rank: 1, name: 'Granite Construction', nameNormalized: 'granite', totalCents: 200_000_00, awardedTo: true }),
          bidder({ rank: 2, name: 'Mercer-Fraser', nameNormalized: 'mercer-fraser', totalCents: 210_000_00 }),
        ],
      }),
    ]);

    expect(r.rollup.tabsConsidered).toBe(2);
    expect(r.rollup.uniqueCompetitors).toBe(3);

    const granite = r.rows.find((x) => x.nameNormalized === 'granite');
    expect(granite?.appearances).toBe(2);
    expect(granite?.apparentLowCount).toBe(2);
    expect(granite?.awardCount).toBe(1);
    expect(granite?.firstSeenAt).toBe('2026-04-01');
    expect(granite?.lastSeenAt).toBe('2026-05-01');
    expect(granite?.topAgencies[0]?.agencyName).toBe('Caltrans D2');
    expect(granite?.topAgencies[0]?.count).toBe(2);

    const counties = (granite?.topCounties ?? []).map((c) => c.county).sort();
    expect(counties).toEqual(['Shasta', 'Trinity']);
  });

  it('respects minAppearances', () => {
    const r = buildCompetitorProfilesFromTabs(
      [
        tab({
          bidders: [
            bidder({ rank: 1, name: 'Granite', nameNormalized: 'granite' }),
            bidder({ rank: 2, name: 'Once-only', nameNormalized: 'once-only' }),
          ],
        }),
      ],
      2,
    );
    expect(r.rows).toHaveLength(0);
  });

  it('flags ever-DBE / ever-rejected', () => {
    const r = buildCompetitorProfilesFromTabs([
      tab({
        bidders: [
          bidder({ rank: 1, name: 'A', nameNormalized: 'a', dbe: true }),
          bidder({ rank: 2, name: 'B', nameNormalized: 'b', rejected: true }),
        ],
      }),
    ]);
    const a = r.rows.find((x) => x.nameNormalized === 'a');
    const b = r.rows.find((x) => x.nameNormalized === 'b');
    expect(a?.everDbe).toBe(true);
    expect(b?.everRejected).toBe(true);
  });
});
