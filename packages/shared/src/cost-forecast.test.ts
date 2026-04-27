import { describe, expect, it } from 'vitest';
import { buildCostForecast } from './cost-forecast';
import type { WipRow } from './wip';

function wip(over: Partial<WipRow>): WipRow {
  return {
    jobId: 'job-1',
    projectName: 'Test Job',
    status: 'ACTIVE',
    originalContractCents: 1_000_000_00,
    changeOrderTotalCents: 0,
    adjustedContractCents: 1_000_000_00,
    estimatedCostAtCompletionCents: 800_000_00,
    estimatedGrossProfitCents: 200_000_00,
    costsIncurredCents: 0,
    percentComplete: 0,
    earnedRevenueCents: 0,
    billedToDateCents: 0,
    collectedToDateCents: 0,
    retentionHeldCents: 0,
    overBilledCents: 0,
    underBilledCents: 0,
    ...over,
  } as WipRow;
}

describe('buildCostForecast', () => {
  it('on-budget job: BAC=800k, AC=400k, 50% complete → CPI=1, FEAC=800k', () => {
    const { rows } = buildCostForecast([
      wip({
        estimatedCostAtCompletionCents: 800_000_00,
        costsIncurredCents: 400_000_00,
        percentComplete: 0.5,
      }),
    ]);
    expect(rows[0]?.earnedValueCents).toBe(400_000_00);
    expect(rows[0]?.costPerformanceIndex).toBe(1);
    expect(rows[0]?.forecastEacCents).toBe(800_000_00);
    expect(rows[0]?.costToCompleteCents).toBe(400_000_00);
    expect(rows[0]?.varianceAtCompletionCents).toBe(0);
    expect(rows[0]?.flag).toBe('ON_TRACK');
  });

  it('over-budget job: AC=600k for 50% complete on 800k BAC → CPI=0.667, FEAC=1.2M', () => {
    const { rows } = buildCostForecast([
      wip({
        estimatedCostAtCompletionCents: 800_000_00,
        costsIncurredCents: 600_000_00,
        percentComplete: 0.5,
      }),
    ]);
    // EV = 50% × 800k = 400k. CPI = 400k/600k = 0.667.
    // FEAC = 600k + (800k - 400k)/0.667 = 600k + 600k = 1_200k.
    expect(rows[0]?.costPerformanceIndex).toBeCloseTo(0.6667, 3);
    expect(rows[0]?.forecastEacCents).toBeCloseTo(1_200_000_00, -2);
    expect(rows[0]?.varianceAtCompletionCents).toBeCloseTo(-400_000_00, -2);
    expect(rows[0]?.flag).toBe('OVER_BUDGET');
  });

  it('under-budget job: AC=300k for 50% complete on 800k BAC → CPI=1.333, FEAC=600k', () => {
    const { rows } = buildCostForecast([
      wip({
        estimatedCostAtCompletionCents: 800_000_00,
        costsIncurredCents: 300_000_00,
        percentComplete: 0.5,
      }),
    ]);
    // EV = 400k. CPI = 400k/300k = 1.333. FEAC = 300k + (800k-400k)/1.333 ≈ 600k.
    expect(rows[0]?.costPerformanceIndex).toBeCloseTo(1.3333, 3);
    expect(rows[0]?.forecastEacCents).toBeCloseTo(600_000_00, -2);
    expect(rows[0]?.varianceAtCompletionCents).toBeCloseTo(200_000_00, -2);
    expect(rows[0]?.flag).toBe('ON_TRACK');
  });

  it('AT_RISK band: CPI = 0.90', () => {
    // Want CPI = 0.9 → AC = EV / 0.9. With BAC=1000k, pct=0.5, EV=500k, AC=555.6k.
    const { rows } = buildCostForecast([
      wip({
        estimatedCostAtCompletionCents: 1_000_000_00,
        costsIncurredCents: Math.round(500_000_00 / 0.9),
        percentComplete: 0.5,
      }),
    ]);
    expect(rows[0]?.flag).toBe('AT_RISK');
  });

  it('COMPLETE flag wins regardless of CPI; FEAC pinned to AC', () => {
    const { rows } = buildCostForecast([
      wip({
        estimatedCostAtCompletionCents: 800_000_00,
        costsIncurredCents: 1_500_000_00, // way over
        percentComplete: 1,
      }),
    ]);
    expect(rows[0]?.flag).toBe('COMPLETE');
    expect(rows[0]?.forecastEacCents).toBe(1_500_000_00);
    expect(rows[0]?.costToCompleteCents).toBe(0);
  });

  it('AC=0 gives neutral CPI=1 and FEAC=BAC', () => {
    const { rows } = buildCostForecast([
      wip({
        estimatedCostAtCompletionCents: 800_000_00,
        costsIncurredCents: 0,
        percentComplete: 0,
      }),
    ]);
    expect(rows[0]?.costPerformanceIndex).toBe(1);
    expect(rows[0]?.forecastEacCents).toBe(800_000_00);
    expect(rows[0]?.costToCompleteCents).toBe(800_000_00);
  });

  it('clamps percentComplete to [0, 1]', () => {
    const { rows } = buildCostForecast([
      wip({
        estimatedCostAtCompletionCents: 800_000_00,
        costsIncurredCents: 400_000_00,
        percentComplete: 1.5, // bogus
      }),
    ]);
    expect(rows[0]?.percentComplete).toBe(1);
    expect(rows[0]?.flag).toBe('COMPLETE');
  });

  it('sorts worst-CPI first; COMPLETE jobs pinned to bottom', () => {
    const { rows } = buildCostForecast([
      wip({
        jobId: 'job-good',
        estimatedCostAtCompletionCents: 800_000_00,
        costsIncurredCents: 300_000_00,
        percentComplete: 0.5,
      }),
      wip({
        jobId: 'job-bad',
        estimatedCostAtCompletionCents: 800_000_00,
        costsIncurredCents: 700_000_00,
        percentComplete: 0.5,
      }),
      wip({
        jobId: 'job-done',
        estimatedCostAtCompletionCents: 800_000_00,
        costsIncurredCents: 600_000_00,
        percentComplete: 1,
      }),
    ]);
    expect(rows.map((r) => r.jobId)).toEqual(['job-bad', 'job-good', 'job-done']);
  });

  it('rollup blends CPI across jobs and counts over-budget', () => {
    const { rollup } = buildCostForecast([
      wip({
        jobId: 'a',
        estimatedCostAtCompletionCents: 1_000_000_00,
        costsIncurredCents: 500_000_00,
        percentComplete: 0.5,
      }),
      wip({
        jobId: 'b',
        estimatedCostAtCompletionCents: 1_000_000_00,
        costsIncurredCents: 800_000_00, // 80% spent for 50% done = bleeding
        percentComplete: 0.5,
      }),
    ]);
    expect(rollup.jobs).toBe(2);
    expect(rollup.totalEarnedValueCents).toBe(1_000_000_00); // 500k + 500k
    expect(rollup.totalActualCostCents).toBe(1_300_000_00);
    expect(rollup.blendedCostPerformanceIndex).toBeCloseTo(1_000_000_00 / 1_300_000_00, 3);
    expect(rollup.overBudgetJobCount).toBe(1);
  });
});
