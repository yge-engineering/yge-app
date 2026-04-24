import { describe, it, expect } from 'vitest';
import { rollupBidItem, rollupEstimate } from './estimate';

describe('rollupBidItem', () => {
  it('sums lines and applies O&P', () => {
    const item = {
      lines: [{ extendedCents: 10000 }, { extendedCents: 5000 }, { extendedCents: 2500 }],
    };
    const r = rollupBidItem(item, 0.2);
    expect(r.directCents).toBe(17500);
    expect(r.oppCents).toBe(3500);
    expect(r.bidCents).toBe(21000);
  });

  it('handles an empty bid item', () => {
    const r = rollupBidItem({ lines: [] }, 0.2);
    expect(r.directCents).toBe(0);
    expect(r.oppCents).toBe(0);
    expect(r.bidCents).toBe(0);
  });
});

describe('rollupEstimate', () => {
  it('rolls up multiple bid items to the grand total', () => {
    const est = {
      oppPercent: 0.2,
      bidItems: [
        { lines: [{ extendedCents: 50000 }] },
        { lines: [{ extendedCents: 30000 }, { extendedCents: 20000 }] },
      ],
    };
    const r = rollupEstimate(est);
    expect(r.directCents).toBe(100000);
    expect(r.oppCents).toBe(20000);
    expect(r.bidCents).toBe(120000);
    expect(r.bidItems).toHaveLength(2);
    expect(r.bidItems[0]?.bidCents).toBe(60000);
    expect(r.bidItems[1]?.bidCents).toBe(60000);
  });
});
