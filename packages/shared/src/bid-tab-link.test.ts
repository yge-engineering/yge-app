import { describe, expect, it } from 'vitest';

import type { BidResult } from './bid-result';
import type { BidTab } from './bid-tab';
import { linkYgeOnImport, YGE_NORMALIZED_NAME_DEFAULT } from './bid-tab-link';

function tab(over: Partial<BidTab>): BidTab {
  return {
    id: 'bidtab-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    scrapedAt: '2026-04-01T00:00:00.000Z',
    source: 'CALTRANS',
    agencyName: 'Caltrans D2',
    ownerType: 'STATE',
    projectName: 'SR-299 paving',
    state: 'CA',
    bidOpenedAt: '2026-04-01',
    bidders: [
      {
        rank: 1,
        name: 'Young General Engineering Inc',
        nameNormalized: YGE_NORMALIZED_NAME_DEFAULT,
        totalCents: 4_000_000_00,
      },
    ],
    ...over,
  } as BidTab;
}

function bidResult(over: Partial<BidResult> & { projectName?: string }): BidResult {
  const { projectName, ...rest } = over;
  const base = {
    id: 'br-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'job-1',
    bidOpenedAt: '2026-04-01',
    outcome: 'WON_BY_OTHER',
    bidders: [],
    ...rest,
  } as BidResult;
  if (projectName) {
    (base as unknown as { projectName: string }).projectName = projectName;
  }
  return base;
}

describe('linkYgeOnImport', () => {
  it('returns ygeWasBidder=false when YGE is not on the tab', () => {
    const r = linkYgeOnImport({
      tab: tab({
        bidders: [
          {
            rank: 1,
            name: 'Granite',
            nameNormalized: 'granite',
            totalCents: 4_000_000_00,
          },
        ],
      }),
      bidResults: [bidResult({})],
    });
    expect(r.ygeWasBidder).toBe(false);
    expect(r.matchedBidResultId).toBeNull();
  });

  it('matches by projectName + same bid-open day', () => {
    const r = linkYgeOnImport({
      tab: tab({}),
      bidResults: [
        bidResult({ id: 'br-99', jobId: 'job-99', bidOpenedAt: '2026-04-01', projectName: 'SR-299 paving' }),
      ],
    });
    expect(r.ygeWasBidder).toBe(true);
    expect(r.matchedBidResultId).toBe('br-99');
    expect(r.matchedJobId).toBe('job-99');
    expect(r.matchStrategy).toBe('projectName');
  });

  it('matches by projectName prefix when tab name has agency-prefix noise', () => {
    const r = linkYgeOnImport({
      tab: tab({ projectName: '02-1H4404 — SR-299 paving' }),
      bidResults: [
        bidResult({ id: 'br-9', jobId: 'job-9', bidOpenedAt: '2026-04-01', projectName: 'SR-299 paving' }),
      ],
    });
    expect(r.matchStrategy).toBe('projectNamePrefix');
    expect(r.matchedJobId).toBe('job-9');
  });

  it('rejects matches outside the ±1 day window', () => {
    const r = linkYgeOnImport({
      tab: tab({ bidOpenedAt: '2026-04-01' }),
      bidResults: [
        bidResult({ id: 'br-9', jobId: 'job-9', bidOpenedAt: '2026-05-01', projectName: 'SR-299 paving' }),
      ],
    });
    expect(r.ygeWasBidder).toBe(true);
    expect(r.matchedBidResultId).toBeNull();
  });

  it('honors a custom ygeNormalizedName', () => {
    const r = linkYgeOnImport({
      tab: tab({
        bidders: [
          { rank: 1, name: 'OtherCo', nameNormalized: 'otherco', totalCents: 1_000_000_00 },
        ],
      }),
      bidResults: [],
      ygeNormalizedName: 'otherco',
    });
    expect(r.ygeWasBidder).toBe(true);
  });
});
