import { describe, expect, it } from 'vitest';
import {
  BidTabSchema,
  buildCompetitorProfile,
  computeBidTabRollup,
  newBidTabId,
  normalizeCompanyName,
  searchBidTabs,
  type BidTab,
} from './bid-tab';

function tab(over: Partial<BidTab>): BidTab {
  return BidTabSchema.parse({
    id: 'bidtab-aaaaaaaa',
    createdAt: '2026-04-01T08:00:00Z',
    updatedAt: '2026-04-01T08:00:00Z',
    scrapedAt: '2026-04-01T08:00:00Z',
    source: 'CALTRANS',
    agencyName: 'Caltrans District 2',
    ownerType: 'STATE',
    projectName: 'SR-89 Drainage Improvement',
    state: 'CA',
    county: 'Shasta',
    bidOpenedAt: '2026-03-25',
    bidders: [
      { rank: 1, name: 'Granite Construction Inc', nameNormalized: 'granite', totalCents: 1_200_000_00, awardedTo: true },
      { rank: 2, name: 'Tullis Inc.', nameNormalized: 'tullis', totalCents: 1_350_000_00 },
    ],
    ...over,
  });
}

describe('newBidTabId', () => {
  it('produces a bidtab-<8hex> id', () => {
    expect(newBidTabId()).toMatch(/^bidtab-[0-9a-f]{8}$/);
  });
});

describe('normalizeCompanyName', () => {
  it('collapses entity suffixes', () => {
    expect(normalizeCompanyName('Granite Construction Company, Inc.')).toBe('granite');
    expect(normalizeCompanyName('Granite Construction LLC')).toBe('granite');
    expect(normalizeCompanyName('GRANITE CONSTRUCTION CORP')).toBe('granite');
    expect(normalizeCompanyName('Granite Construction Co')).toBe('granite');
  });

  it('preserves distinct names', () => {
    const a = normalizeCompanyName('Granite Bay Construction');
    const b = normalizeCompanyName('Granite Construction');
    expect(a).not.toBe(b);
  });

  it('handles trailing parens and odd punctuation', () => {
    expect(normalizeCompanyName('Tullis, Inc. (Prime)')).toBe('tullis');
    expect(normalizeCompanyName('M & M Excavating, LLC')).toBe('m m excavating');
  });

  it('handles repeated suffixes like "Inc Corp"', () => {
    expect(normalizeCompanyName('ABC Construction Inc Corp')).toBe('abc');
  });

  it('returns empty for an empty input', () => {
    expect(normalizeCompanyName('')).toBe('');
  });
});

describe('BidTabSchema', () => {
  it('rejects an empty bidders list', () => {
    expect(() => tab({ bidders: [] })).toThrow();
  });

  it('rejects an invalid state code length', () => {
    expect(() => tab({ state: 'CAL' })).toThrow();
  });

  it('defaults state to CA when omitted', () => {
    const t = BidTabSchema.parse({
      id: 'bidtab-bbbbbbbb',
      createdAt: '2026-04-01T08:00:00Z',
      updatedAt: '2026-04-01T08:00:00Z',
      scrapedAt: '2026-04-01T08:00:00Z',
      source: 'COUNTY',
      agencyName: 'Shasta County',
      ownerType: 'COUNTY',
      projectName: 'Test',
      bidOpenedAt: '2026-03-25',
      bidders: [{ rank: 1, name: 'x', nameNormalized: 'x', totalCents: 100 }],
    });
    expect(t.state).toBe('CA');
  });
});

describe('buildCompetitorProfile', () => {
  const tabs: BidTab[] = [
    tab({
      id: 'bidtab-1', bidOpenedAt: '2026-01-15', agencyName: 'Caltrans D2',
      bidders: [
        { rank: 1, name: 'Granite Construction Inc', nameNormalized: 'granite', totalCents: 1_000_000_00, awardedTo: true },
        { rank: 2, name: 'YGE', nameNormalized: 'young general engineering', totalCents: 1_100_000_00 },
      ],
    }),
    tab({
      id: 'bidtab-2', bidOpenedAt: '2026-02-15', agencyName: 'Cal Fire',
      bidders: [
        { rank: 1, name: 'YGE', nameNormalized: 'young general engineering', totalCents: 800_000_00, awardedTo: true },
        { rank: 2, name: 'Granite Construction', nameNormalized: 'granite', totalCents: 900_000_00 },
      ],
    }),
    tab({
      id: 'bidtab-3', bidOpenedAt: '2026-03-15', agencyName: 'Shasta County',
      bidders: [
        { rank: 1, name: 'Other Co', nameNormalized: 'other', totalCents: 500_000_00, awardedTo: true },
        { rank: 2, name: 'Granite Construction Co', nameNormalized: 'granite', totalCents: 600_000_00 },
      ],
    }),
  ];

  it('returns null when the competitor never appears', () => {
    expect(buildCompetitorProfile('does-not-exist', tabs)).toBeNull();
  });

  it('rolls up totals + win rate + ranks + agency set', () => {
    const p = buildCompetitorProfile('granite', tabs)!;
    expect(p).toBeTruthy();
    expect(p.totalBids).toBe(3);
    expect(p.totalWins).toBe(1);
    expect(p.winRate).toBeCloseTo(1 / 3, 4);
    expect(p.avgRank).toBeCloseTo((1 + 2 + 2) / 3, 4);
    expect(p.firstSeenAt).toBe('2026-01-15');
    expect(p.lastSeenAt).toBe('2026-03-15');
    expect(p.agenciesSeen.length).toBe(3);
  });

  it('computes head-to-head with YGE', () => {
    const p = buildCompetitorProfile('granite', tabs)!;
    expect(p.bidsAgainstYge).toBe(2);
    expect(p.ygeWonAgainst).toBe(1); // tab 2 — YGE won
  });

  it('average % over low on losses skips wins + missing low', () => {
    const p = buildCompetitorProfile('granite', tabs)!;
    // Granite WON tab1 — that's a win, skipped from this calc.
    // Losses: tab2 ranked 2 at 0.9M (low 0.8M, +12.5%); tab3 ranked
    // 2 at 0.6M (low 0.5M, +20%) — average = (0.125 + 0.20) / 2 = 0.1625
    expect(p.avgPctOverLowOnLosses).toBeCloseTo(0.1625, 4);
  });
});

describe('searchBidTabs', () => {
  const tabs: BidTab[] = [
    tab({
      id: 'bidtab-1',
      projectName: 'SR-89 Drainage Improvement',
      county: 'Shasta',
      bidders: [
        { rank: 1, name: 'Granite Construction Inc', nameNormalized: 'granite', totalCents: 1_000_000_00 },
      ],
    }),
    tab({
      id: 'bidtab-2',
      projectName: 'Cottonwood Creek Bridge Replacement',
      county: 'Tehama',
      notes: 'Bridge work + retaining wall',
      bidders: [
        { rank: 1, name: 'Tullis Inc', nameNormalized: 'tullis', totalCents: 2_000_000_00 },
      ],
    }),
  ];

  it('returns nothing for queries shorter than 2 chars', () => {
    expect(searchBidTabs('x', tabs)).toEqual([]);
  });

  it('matches on project name', () => {
    const hits = searchBidTabs('drainage', tabs);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.tab.id).toBe('bidtab-1');
    expect(hits[0]!.matches[0]!.toLowerCase()).toContain('drainage');
  });

  it('matches on bidder name', () => {
    const hits = searchBidTabs('granite', tabs);
    expect(hits[0]!.tab.id).toBe('bidtab-1');
  });

  it('matches on county + notes', () => {
    const hits = searchBidTabs('tehama', tabs);
    expect(hits[0]!.tab.id).toBe('bidtab-2');

    const noteHits = searchBidTabs('retaining', tabs);
    expect(noteHits[0]!.tab.id).toBe('bidtab-2');
  });

  it('orders by score then most-recent bidOpenedAt', () => {
    const a = tab({ id: 'bidtab-a', projectName: 'Drainage A', bidOpenedAt: '2026-01-01' });
    const b = tab({ id: 'bidtab-b', projectName: 'Drainage B', bidOpenedAt: '2026-03-01' });
    const hits = searchBidTabs('drainage', [a, b]);
    expect(hits.map((h) => h.tab.id)).toEqual(['bidtab-b', 'bidtab-a']);
  });
});

describe('computeBidTabRollup', () => {
  it('totals + agency mix + source mix + competitors + last open', () => {
    const tabs: BidTab[] = [
      tab({ id: 'bidtab-1', source: 'CALTRANS', agencyName: 'Caltrans D2', bidOpenedAt: '2026-01-15' }),
      tab({ id: 'bidtab-2', source: 'CALTRANS', agencyName: 'Caltrans D2', bidOpenedAt: '2026-03-15' }),
      tab({
        id: 'bidtab-3', source: 'COUNTY', agencyName: 'Shasta County', bidOpenedAt: '2026-02-15',
        bidders: [{ rank: 1, name: 'X', nameNormalized: 'x-co', totalCents: 100, awardedTo: true }],
      }),
    ];
    const r = computeBidTabRollup(tabs);
    expect(r.total).toBe(3);
    expect(r.bySource.CALTRANS).toBe(2);
    expect(r.bySource.COUNTY).toBe(1);
    expect(r.byAgency[0]!.agencyName).toBe('Caltrans D2');
    expect(r.byAgency[0]!.count).toBe(2);
    expect(r.lastBidOpenedAt).toBe('2026-03-15');
    expect(r.distinctCompetitors).toBeGreaterThanOrEqual(3);
  });

  it('handles empty input', () => {
    const r = computeBidTabRollup([]);
    expect(r.total).toBe(0);
    expect(r.lastBidOpenedAt).toBeNull();
    expect(r.totalAwardedCents).toBe(0);
  });
});
