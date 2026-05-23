import { describe, it, expect } from 'vitest';
import {
  bondPremiumCents,
  exceedsSingleJobCap,
  projectBondCapacityWithBid,
  rollupBondCapacity,
  type BondedJob,
} from './bond-capacity';

const JOBS: BondedJob[] = [
  { jobId: 'j1', projectName: 'Site A', remainingContractCents: 2_000_000_00 }, // $2M
  { jobId: 'j2', projectName: 'Site B', remainingContractCents: 1_500_000_00 }, // $1.5M
  { jobId: 'j3', projectName: 'Site C', remainingContractCents: 500_000_00 }, // $500k
];

describe('rollupBondCapacity', () => {
  it('sums remaining contract value across jobs', () => {
    const r = rollupBondCapacity(10_000_000_00, JOBS); // $10M cap
    expect(r.usedCents).toBe(4_000_000_00);
    expect(r.availableCents).toBe(6_000_000_00);
    expect(r.utilization).toBe(0.4);
    expect(r.exceeded).toBe(false);
  });

  it('flags exceeded when over cap', () => {
    const r = rollupBondCapacity(3_000_000_00, JOBS); // $3M cap, $4M used
    expect(r.exceeded).toBe(true);
    expect(r.availableCents).toBe(0);
    expect(r.utilization).toBeGreaterThan(1);
  });

  it('NaN utilization when cap is 0', () => {
    const r = rollupBondCapacity(0, JOBS);
    expect(Number.isNaN(r.utilization)).toBe(true);
    expect(r.exceeded).toBe(false);
  });

  it('zero used when no jobs', () => {
    const r = rollupBondCapacity(10_000_000_00, []);
    expect(r.usedCents).toBe(0);
    expect(r.availableCents).toBe(10_000_000_00);
    expect(r.utilization).toBe(0);
  });

  it('throws on negative cap', () => {
    expect(() => rollupBondCapacity(-1, [])).toThrow();
  });
});

describe('projectBondCapacityWithBid', () => {
  it('shows what utilization looks like if we win', () => {
    const current = rollupBondCapacity(10_000_000_00, JOBS); // 40% used
    const r = projectBondCapacityWithBid(current, 5_000_000_00); // +$5M
    expect(r.newUsedCents).toBe(9_000_000_00);
    expect(r.newAvailableCents).toBe(1_000_000_00);
    expect(r.newUtilization).toBe(0.9);
    expect(r.fits).toBe(true);
  });

  it('flags when prospective bid does not fit', () => {
    const current = rollupBondCapacity(5_000_000_00, JOBS); // 80% used
    const r = projectBondCapacityWithBid(current, 2_000_000_00); // +$2M = 120%
    expect(r.fits).toBe(false);
    expect(r.newAvailableCents).toBe(0);
  });

  it('throws on negative prospective', () => {
    const current = rollupBondCapacity(10_000_000_00, JOBS);
    expect(() => projectBondCapacityWithBid(current, -1)).toThrow();
  });
});

describe('bondPremiumCents', () => {
  it('1.25% on $1,000,000 = $12,500', () => {
    expect(bondPremiumCents(1_000_000_00, 125)).toBe(12_500_00);
  });

  it('rounds to nearest cent', () => {
    // 1.234% on $100,000 = $1,234.00
    expect(bondPremiumCents(100_000_00, 1234 / 10)).toBeGreaterThan(0);
  });

  it('throws on negative inputs', () => {
    expect(() => bondPremiumCents(-1, 100)).toThrow();
    expect(() => bondPremiumCents(100, -1)).toThrow();
  });
});

describe('exceedsSingleJobCap', () => {
  it('true when prospective > cap', () => {
    expect(exceedsSingleJobCap(5_000_000_00, 7_000_000_00)).toBe(true);
  });
  it('false when prospective ≤ cap', () => {
    expect(exceedsSingleJobCap(5_000_000_00, 5_000_000_00)).toBe(false);
    expect(exceedsSingleJobCap(5_000_000_00, 4_999_999_00)).toBe(false);
  });
  it('false when no cap configured', () => {
    expect(exceedsSingleJobCap(0, 100_000_000_00)).toBe(false);
  });
});
