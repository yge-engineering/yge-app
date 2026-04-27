import { describe, expect, it } from 'vitest';
import { buildBidAnalytics } from './bid-analytics';
import type { BidResult } from './bid-result';

function bidResult(over: Partial<BidResult>): BidResult {
  return {
    id: 'br-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'job-1',
    bidOpenedAt: '2026-04-01',
    outcome: 'WON_BY_OTHER',
    bidders: [],
    ...over,
  } as BidResult;
}

describe('buildBidAnalytics', () => {
  it('computes ygeRank and spreads when YGE bid', () => {
    const r = buildBidAnalytics({
      bidResults: [
        bidResult({
          outcome: 'WON_BY_OTHER',
          engineersEstimateCents: 1_100_000_00,
          bidders: [
            { bidderName: 'Granite', amountCents: 950_000_00, isYge: false },
            { bidderName: 'YGE', amountCents: 1_000_000_00, isYge: true },
            { bidderName: 'Other', amountCents: 1_100_000_00, isYge: false },
          ],
        }),
      ],
    });
    const row = r.rows[0]!;
    expect(row.ygeRank).toBe(2);
    expect(row.bidderCount).toBe(3);
    expect(row.winnerBidCents).toBe(950_000_00);
    expect(row.spreadToWinnerCents).toBe(50_000_00);     // 1M - 950k
    expect(row.spreadToSecondCents).toBe(50_000_00);     // YGE was over 950k by 50k
    expect(row.spreadToEngineersEstimateCents).toBe(-100_000_00); // YGE 1M, EE 1.1M
  });

  it('computes win cushion when YGE wins', () => {
    const r = buildBidAnalytics({
      bidResults: [
        bidResult({
          outcome: 'WON_BY_YGE',
          bidders: [
            { bidderName: 'YGE', amountCents: 900_000_00, isYge: true },
            { bidderName: 'Other', amountCents: 950_000_00, isYge: false },
            { bidderName: 'Other2', amountCents: 1_000_000_00, isYge: false },
          ],
        }),
      ],
    });
    const row = r.rows[0]!;
    expect(row.ygeRank).toBe(1);
    expect(row.spreadToWinnerCents).toBe(0);  // YGE IS the winner
    // YGE 900k, second 950k → spread is -50k (YGE was under second by 50k)
    expect(row.spreadToSecondCents).toBe(-50_000_00);
  });

  it('returns null fields when YGE did not bid', () => {
    const r = buildBidAnalytics({
      bidResults: [
        bidResult({
          outcome: 'WON_BY_OTHER',
          bidders: [
            { bidderName: 'Granite', amountCents: 950_000_00, isYge: false },
            { bidderName: 'Beck', amountCents: 1_000_000_00, isYge: false },
          ],
        }),
      ],
    });
    const row = r.rows[0]!;
    expect(row.ygeBidCents).toBeNull();
    expect(row.ygeRank).toBeNull();
    expect(row.spreadToWinnerCents).toBeNull();
    expect(row.spreadToSecondCents).toBeNull();
  });

  it('summary win rate excludes TBD', () => {
    const r = buildBidAnalytics({
      bidResults: [
        bidResult({
          jobId: 'job-1',
          outcome: 'WON_BY_YGE',
          bidders: [
            { bidderName: 'YGE', amountCents: 1_000_00, isYge: true },
            { bidderName: 'Other', amountCents: 1_500_00, isYge: false },
          ],
        }),
        bidResult({
          jobId: 'job-2',
          outcome: 'WON_BY_OTHER',
          bidders: [
            { bidderName: 'Other', amountCents: 1_000_00, isYge: false },
            { bidderName: 'YGE', amountCents: 1_500_00, isYge: true },
          ],
        }),
        bidResult({
          jobId: 'job-3',
          outcome: 'TBD',
          bidders: [
            { bidderName: 'YGE', amountCents: 2_000_00, isYge: true },
            { bidderName: 'Other', amountCents: 2_500_00, isYge: false },
          ],
        }),
      ],
    });
    expect(r.summary.bidsConsidered).toBe(3);
    expect(r.summary.ygeBidCount).toBe(3);
    expect(r.summary.ygeWonCount).toBe(1);
    // 1 win, 1 loss, 1 TBD → decided=2, winRate=0.5
    expect(r.summary.winRate).toBe(0.5);
  });

  it('avgLossSpread averages YGE-over-winner across LOST bids', () => {
    const r = buildBidAnalytics({
      bidResults: [
        bidResult({
          jobId: 'job-1',
          outcome: 'WON_BY_OTHER',
          bidders: [
            { bidderName: 'Other', amountCents: 100_00, isYge: false },
            { bidderName: 'YGE', amountCents: 110_00, isYge: true }, // 10 over
          ],
        }),
        bidResult({
          jobId: 'job-2',
          outcome: 'WON_BY_OTHER',
          bidders: [
            { bidderName: 'Other', amountCents: 100_00, isYge: false },
            { bidderName: 'YGE', amountCents: 130_00, isYge: true }, // 30 over
          ],
        }),
      ],
    });
    expect(r.summary.avgLossSpreadCents).toBe(20_00); // mean of 10_00 and 30_00
  });

  it('avgWinCushion is positive (money left on the table)', () => {
    const r = buildBidAnalytics({
      bidResults: [
        bidResult({
          jobId: 'job-1',
          outcome: 'WON_BY_YGE',
          bidders: [
            { bidderName: 'YGE', amountCents: 100_00, isYge: true },
            { bidderName: 'Other', amountCents: 120_00, isYge: false }, // 20 cushion
          ],
        }),
      ],
    });
    expect(r.summary.avgWinCushionCents).toBe(20_00);
  });

  it('byProjectType + byOwnerAgency rolls win rate per dimension', () => {
    const r = buildBidAnalytics({
      bidResults: [
        bidResult({
          jobId: 'job-A',
          outcome: 'WON_BY_YGE',
          bidders: [
            { bidderName: 'YGE', amountCents: 1_000_00, isYge: true },
            { bidderName: 'X', amountCents: 1_500_00, isYge: false },
          ],
        }),
        bidResult({
          jobId: 'job-B',
          outcome: 'WON_BY_OTHER',
          bidders: [
            { bidderName: 'X', amountCents: 1_000_00, isYge: false },
            { bidderName: 'YGE', amountCents: 1_500_00, isYge: true },
          ],
        }),
      ],
      projectTypeByJobId: new Map([
        ['job-A', 'ROAD_RECONSTRUCTION'],
        ['job-B', 'BRIDGE'],
      ]),
      ownerAgencyByJobId: new Map([
        ['job-A', 'Caltrans'],
        ['job-B', 'County of Shasta'],
      ]),
    });
    expect(r.summary.byProjectType.get('ROAD_RECONSTRUCTION')?.rate).toBe(1);
    expect(r.summary.byProjectType.get('BRIDGE')?.rate).toBe(0);
    expect(r.summary.byOwnerAgency.get('Caltrans')?.rate).toBe(1);
  });

  it('sorts rows newest first', () => {
    const r = buildBidAnalytics({
      bidResults: [
        bidResult({ jobId: 'old', bidOpenedAt: '2025-01-15', bidders: [] }),
        bidResult({ jobId: 'new', bidOpenedAt: '2026-04-01', bidders: [] }),
        bidResult({ jobId: 'mid', bidOpenedAt: '2025-08-01', bidders: [] }),
      ],
    });
    expect(r.rows.map((x) => x.jobId)).toEqual(['new', 'mid', 'old']);
  });
});
