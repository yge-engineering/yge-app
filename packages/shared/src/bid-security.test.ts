import { describe, it, expect } from 'vitest';
import {
  bidSecurityAmountCents,
  bidSecurityTypeLabel,
  defaultBidSecurity,
  type BidSecurity,
} from './bid-security';

describe('defaultBidSecurity', () => {
  it('returns a 10% bid bond — the most common CA public works case', () => {
    const sec = defaultBidSecurity();
    expect(sec.type).toBe('BID_BOND');
    expect(sec.percent).toBe(0.1);
  });
});

describe('bidSecurityAmountCents', () => {
  it('computes 10% of the bid total at the default percent', () => {
    // $100,000 bid → $10,000 bond = 1_000_000 cents
    expect(
      bidSecurityAmountCents(100_000_00, defaultBidSecurity()),
    ).toBe(10_000_00);
  });

  it('honors a custom percent', () => {
    const sec: BidSecurity = { type: 'BID_BOND', percent: 0.05 };
    // $200,000 bid * 5% = $10,000
    expect(bidSecurityAmountCents(200_000_00, sec)).toBe(10_000_00);
  });

  it('returns 0 when bid is 0', () => {
    expect(bidSecurityAmountCents(0, defaultBidSecurity())).toBe(0);
  });

  it('rounds to whole cents', () => {
    // $1,234.57 * 10% = $123.457 → $123.46 (rounds to 12346 cents)
    const sec: BidSecurity = { type: 'BID_BOND', percent: 0.1 };
    expect(bidSecurityAmountCents(1_234_57, sec)).toBe(12346);
  });
});

describe('bidSecurityTypeLabel', () => {
  it('formats every type as plain English', () => {
    expect(bidSecurityTypeLabel('BID_BOND')).toBe('Bid bond');
    expect(bidSecurityTypeLabel('CASHIERS_CHECK')).toBe("Cashier's check");
    expect(bidSecurityTypeLabel('CERTIFIED_CHECK')).toBe('Certified check');
    expect(bidSecurityTypeLabel('OTHER')).toBe('Other security');
  });
});
