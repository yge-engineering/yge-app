import { describe, expect, it } from 'vitest';

import {
  bidVsActualVariance,
  bidVsLowVariance,
  findComparableJobs,
  type HistoricalJob,
} from './historical-comparables';

const baseJob = (overrides: Partial<HistoricalJob>): HistoricalJob => ({
  id: 'job-x',
  projectName: 'Test Job',
  ownerAgency: null,
  projectType: 'GRADING',
  scopeKeywords: [],
  countyName: null,
  bidTotalCents: 1_000_000_00,
  actualCostCents: null,
  outcome: 'unknown',
  awardSpread: null,
  notesForFuture: null,
  bidAt: '2024-01-01',
  ...overrides,
});

describe('findComparableJobs', () => {
  it('returns empty when history is empty', () => {
    const out = findComparableJobs(
      { projectType: 'GRADING', scopeKeywords: ['pad'], countyName: 'sacramento' },
      [],
    );
    expect(out).toEqual([]);
  });

  it('scores a same-type same-scope same-county match at 100', () => {
    const job = baseJob({
      id: 'twin',
      projectType: 'GRADING',
      scopeKeywords: ['pad'],
      countyName: 'sacramento',
    });
    const out = findComparableJobs(
      { projectType: 'GRADING', scopeKeywords: ['pad'], countyName: 'sacramento' },
      [job],
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.similarityScore).toBe(100);
    expect(out[0]?.reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Same project type'),
        expect.stringContaining('Scope overlap'),
        expect.stringContaining('Same county'),
      ]),
    );
  });

  it('excludes a different project type below default minScore', () => {
    // Different type → 0 from type, no scope, no county = 0 score.
    const job = baseJob({
      projectType: 'DRAINAGE',
      scopeKeywords: ['pipe'],
      countyName: 'shasta',
    });
    const out = findComparableJobs(
      { projectType: 'GRADING', scopeKeywords: ['pad'], countyName: 'sacramento' },
      [job],
    );
    expect(out).toEqual([]);
  });

  it('keeps same-type-only match when minScore lowered to 50', () => {
    const job = baseJob({
      projectType: 'GRADING',
      scopeKeywords: [],
      countyName: 'shasta',
    });
    const out = findComparableJobs(
      { projectType: 'GRADING', scopeKeywords: ['pad'], countyName: 'sacramento' },
      [job],
      { minScore: 50 },
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.similarityScore).toBe(50);
  });

  it('ranks by score, breaking ties by most-recent bid date', () => {
    const older = baseJob({
      id: 'older',
      projectType: 'GRADING',
      scopeKeywords: ['pad'],
      countyName: 'sacramento',
      bidAt: '2022-06-01',
    });
    const newer = baseJob({
      id: 'newer',
      projectType: 'GRADING',
      scopeKeywords: ['pad'],
      countyName: 'sacramento',
      bidAt: '2024-06-01',
    });
    const out = findComparableJobs(
      { projectType: 'GRADING', scopeKeywords: ['pad'], countyName: 'sacramento' },
      [older, newer],
    );
    expect(out.map((m) => m.job.id)).toEqual(['newer', 'older']);
  });

  it('caps result count via maxResults', () => {
    const jobs = Array.from({ length: 10 }, (_, i) =>
      baseJob({
        id: `j${i}`,
        projectType: 'GRADING',
        scopeKeywords: ['pad'],
        countyName: 'sacramento',
        bidAt: `2024-01-${String(i + 1).padStart(2, '0')}`,
      }),
    );
    const out = findComparableJobs(
      { projectType: 'GRADING', scopeKeywords: ['pad'], countyName: 'sacramento' },
      jobs,
      { maxResults: 3 },
    );
    expect(out).toHaveLength(3);
  });

  it('partial scope overlap awards proportional points', () => {
    // Query has ["pad","conduit","trench"]; job has ["pad","conduit"].
    // Jaccard = 2 / 3 ≈ 0.667 → ~20 of 30 points.
    const job = baseJob({
      projectType: 'GRADING',
      scopeKeywords: ['pad', 'conduit'],
      countyName: null,
    });
    const out = findComparableJobs(
      {
        projectType: 'GRADING',
        scopeKeywords: ['pad', 'conduit', 'trench'],
        countyName: null,
      },
      [job],
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.similarityScore).toBeGreaterThanOrEqual(50 + 18);
    expect(out[0]?.similarityScore).toBeLessThanOrEqual(50 + 22);
  });

  it('is tolerant of nullable / messy data', () => {
    const job = baseJob({
      projectType: 'GRADING',
      scopeKeywords: [' Pad ', '', 'TRENCH'],  // case/whitespace garbage
      countyName: ' Sacramento ',
    });
    const out = findComparableJobs(
      { projectType: 'GRADING', scopeKeywords: ['pad'], countyName: 'sacramento' },
      [job],
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.similarityScore).toBeGreaterThanOrEqual(70);
  });
});

describe('bidVsActualVariance', () => {
  it('returns null when actual cost is unknown', () => {
    const job = baseJob({ actualCostCents: null });
    expect(bidVsActualVariance(job)).toBeNull();
  });

  it('computes ratio + label when actual > bid', () => {
    const job = baseJob({ bidTotalCents: 1_000_000_00, actualCostCents: 1_400_000_00 });
    const v = bidVsActualVariance(job);
    expect(v?.ratio).toBeCloseTo(1.4, 2);
    expect(v?.pctDeltaPercent).toBe(40);
    expect(v?.label).toMatch(/1\.40× over original bid/);
  });

  it('computes ratio + label when actual < bid', () => {
    const job = baseJob({ bidTotalCents: 1_000_000_00, actualCostCents: 850_000_00 });
    const v = bidVsActualVariance(job);
    expect(v?.ratio).toBeCloseTo(0.85, 2);
    expect(v?.pctDeltaPercent).toBe(-15);
    expect(v?.label).toMatch(/0\.85× under original bid/);
  });

  it('returns "Matched" label when actual equals bid', () => {
    const job = baseJob({ bidTotalCents: 500_000_00, actualCostCents: 500_000_00 });
    const v = bidVsActualVariance(job);
    expect(v?.label).toMatch(/Matched original bid exactly/);
  });
});

describe('bidVsLowVariance', () => {
  it('returns null when no spread known', () => {
    const job = baseJob({ awardSpread: null });
    expect(bidVsLowVariance(job)).toBeNull();
  });

  it('reports how much above the low bidder we were', () => {
    const job = baseJob({
      bidTotalCents: 1_100_000_00,
      awardSpread: {
        ours: 1_100_000_00,
        low: 1_000_000_00,
        rank: 2,
        bidderCount: 4,
      },
    });
    const v = bidVsLowVariance(job);
    expect(v?.ratio).toBeCloseTo(1.1, 2);
    expect(v?.label).toMatch(/over low bidder/);
  });
});
