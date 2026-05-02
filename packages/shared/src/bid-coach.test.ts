import { describe, expect, it } from 'vitest';
import {
  runBidCoach,
  ruleBondingCapacity,
  ruleDeadline,
  ruleMissingBidSecurity,
  ruleUnackedAddenda,
  ruleUnitPriceOutliers,
  ruleUnpricedLines,
  summarizeBidCoach,
  type BidCoachInputs,
  type HistoricalUnitPriceStats,
} from './bid-coach';
import type { PricedEstimate, PricedEstimateTotals } from './priced-estimate';

function est(over: Partial<PricedEstimate> = {}): PricedEstimate {
  return {
    id: 'pe-aaaaaaaa',
    fromDraftId: 'draft-aaaaaaaa',
    jobId: 'job-2026-04-01-test-aaaaaaaa',
    createdAt: '2026-04-15T08:00:00Z',
    updatedAt: '2026-04-15T08:00:00Z',
    projectName: 'Sulphur Springs Fuel Reduction',
    projectType: 'FIRE_FUEL_REDUCTION',
    bidItems: [
      { itemNumber: '1.01', description: 'Mobilization', unit: 'LS', quantity: 1, confidence: 'HIGH', unitPriceCents: 50000_00 },
      { itemNumber: '1.02', description: 'Hand thinning', unit: 'AC', quantity: 100, confidence: 'HIGH', unitPriceCents: 800_00 },
    ],
    oppPercent: 0.15,
    subBids: [],
    addenda: [],
    ...over,
  };
}

function totals(over: Partial<PricedEstimateTotals> = {}): PricedEstimateTotals {
  return {
    directCents: 130_000_00,
    oppCents: 19_500_00,
    bidTotalCents: 149_500_00,
    unpricedLineCount: 0,
    ...over,
  };
}

describe('ruleUnpricedLines', () => {
  it('does not fire when every line is priced', () => {
    expect(ruleUnpricedLines({ estimate: est(), totals: totals() })).toEqual([]);
  });

  it('fires danger when any line is unpriced', () => {
    const flags = ruleUnpricedLines({
      estimate: est(),
      totals: totals({ unpricedLineCount: 3 }),
    });
    expect(flags).toHaveLength(1);
    expect(flags[0]!.severity).toBe('danger');
    expect(flags[0]!.ruleId).toBe('pricing.unpriced-lines');
    expect(flags[0]!.title).toContain('3 bid items');
  });
});

describe('ruleUnitPriceOutliers', () => {
  const history: HistoricalUnitPriceStats = {
    byItemNumber: {
      '1.02': { medianCents: 1000_00, p25Cents: 900_00, p75Cents: 1100_00, sampleSize: 12 },
      '1.03': { medianCents: 500_00, p25Cents: 450_00, p75Cents: 550_00, sampleSize: 3 }, // below threshold
    },
  };

  it('skips silently when history is undefined', () => {
    expect(ruleUnitPriceOutliers({ estimate: est(), totals: totals() })).toEqual([]);
  });

  it('skips lines whose history sample size is below the threshold', () => {
    const e = est({
      bidItems: [
        { itemNumber: '1.03', description: 'X', unit: 'AC', quantity: 10, confidence: 'HIGH', unitPriceCents: 50000_00 },
      ],
    });
    expect(ruleUnitPriceOutliers({ estimate: e, totals: totals(), history })).toEqual([]);
  });

  it('fires danger on a 5x+ overshoot', () => {
    const e = est({
      bidItems: [
        { itemNumber: '1.02', description: 'Hand thinning', unit: 'AC', quantity: 100, confidence: 'HIGH', unitPriceCents: 6000_00 }, // 6x median
      ],
    });
    const flags = ruleUnitPriceOutliers({ estimate: e, totals: totals(), history });
    expect(flags).toHaveLength(1);
    expect(flags[0]!.severity).toBe('danger');
    expect(flags[0]!.ruleId).toBe('pricing.unit-price-outlier-high');
  });

  it('fires warn on a 2.5x-5x overshoot', () => {
    const e = est({
      bidItems: [
        { itemNumber: '1.02', description: 'Hand thinning', unit: 'AC', quantity: 100, confidence: 'HIGH', unitPriceCents: 3000_00 }, // 3x median
      ],
    });
    const flags = ruleUnitPriceOutliers({ estimate: e, totals: totals(), history });
    expect(flags[0]!.severity).toBe('warn');
  });

  it('fires danger on a 25%-or-less undershoot', () => {
    const e = est({
      bidItems: [
        { itemNumber: '1.02', description: 'Hand thinning', unit: 'AC', quantity: 100, confidence: 'HIGH', unitPriceCents: 200_00 }, // 20% of median
      ],
    });
    const flags = ruleUnitPriceOutliers({ estimate: e, totals: totals(), history });
    expect(flags[0]!.severity).toBe('danger');
    expect(flags[0]!.ruleId).toBe('pricing.unit-price-outlier-low');
  });
});

describe('ruleUnackedAddenda', () => {
  it('does not fire when every addendum is acknowledged', () => {
    const e = est({
      addenda: [
        { id: 'add-1', number: '1', acknowledged: true },
        { id: 'add-2', number: '2', acknowledged: true },
      ],
    });
    expect(ruleUnackedAddenda({ estimate: e, totals: totals() })).toEqual([]);
  });

  it('fires danger per un-acked addendum', () => {
    const e = est({
      addenda: [
        { id: 'add-1', number: '1', acknowledged: true },
        { id: 'add-2', number: '2', acknowledged: false, subject: 'Spec section 02 rewrite', dateIssued: '2026-04-10' },
      ],
    });
    const flags = ruleUnackedAddenda({ estimate: e, totals: totals() });
    expect(flags).toHaveLength(1);
    expect(flags[0]!.severity).toBe('danger');
    expect(flags[0]!.message).toContain('Spec section 02 rewrite');
    expect(flags[0]!.message).toContain('2026-04-10');
  });
});

describe('ruleMissingBidSecurity', () => {
  it('does not fire when bid security is recorded', () => {
    const e = est({
      bidSecurity: {
        type: 'BID_BOND',
        amountCents: 14950_00,
        suretyCompany: 'Liberty Mutual',
      },
    });
    expect(ruleMissingBidSecurity({ estimate: e, totals: totals() })).toEqual([]);
  });

  it('does not fire on small bids under the trigger threshold', () => {
    expect(
      ruleMissingBidSecurity({
        estimate: est(),
        totals: totals({ bidTotalCents: 10_000_00 }),
      }),
    ).toEqual([]);
  });

  it('fires warn when no bid security on a bid over the trigger', () => {
    const flags = ruleMissingBidSecurity({ estimate: est(), totals: totals() });
    expect(flags).toHaveLength(1);
    expect(flags[0]!.severity).toBe('warn');
    expect(flags[0]!.ruleId).toBe('contract.missing-bid-security');
  });
});

describe('ruleBondingCapacity', () => {
  it('skips silently when no bonding profile', () => {
    expect(ruleBondingCapacity({ estimate: est(), totals: totals() })).toEqual([]);
  });

  it('fires danger when single-job limit is exceeded', () => {
    const flags = ruleBondingCapacity({
      estimate: est(),
      totals: totals({ bidTotalCents: 5_000_000_00 }),
      bonding: {
        singleJobLimitCents: 3_500_000_00,
        aggregateLimitCents: 10_000_000_00,
        outstandingCents: 0,
      },
    });
    expect(flags.find((f) => f.ruleId === 'bonding.single-job-exceeded')?.severity).toBe('danger');
  });

  it('fires warn when single-job usage is 85%+', () => {
    const flags = ruleBondingCapacity({
      estimate: est(),
      totals: totals({ bidTotalCents: 3_000_000_00 }),
      bonding: {
        singleJobLimitCents: 3_500_000_00,
        aggregateLimitCents: 10_000_000_00,
        outstandingCents: 0,
      },
    });
    expect(flags.find((f) => f.ruleId === 'bonding.single-job-near-limit')?.severity).toBe('warn');
  });

  it('fires danger when projected aggregate exceeds limit', () => {
    const flags = ruleBondingCapacity({
      estimate: est(),
      totals: totals({ bidTotalCents: 4_000_000_00 }),
      bonding: {
        singleJobLimitCents: 10_000_000_00,
        aggregateLimitCents: 5_000_000_00,
        outstandingCents: 2_000_000_00,
      },
    });
    expect(flags.find((f) => f.ruleId === 'bonding.aggregate-exceeded')?.severity).toBe('danger');
  });
});

describe('ruleDeadline', () => {
  const now = new Date('2026-04-15T08:00:00Z');

  it('does not fire when no due date', () => {
    expect(ruleDeadline({ estimate: est(), totals: totals(), now })).toEqual([]);
  });

  it('fires danger when due date is past', () => {
    const e = est({ bidDueDate: '2026-04-10' });
    const flags = ruleDeadline({ estimate: e, totals: totals(), now });
    expect(flags[0]!.ruleId).toBe('deadline.past-due');
    expect(flags[0]!.severity).toBe('danger');
  });

  it('fires danger when under 24h with unpriced lines', () => {
    const e = est({ bidDueDate: '2026-04-15' }); // 11:00 UTC default → 3h ahead of 08:00 UTC now
    const flags = ruleDeadline({
      estimate: e,
      totals: totals({ unpricedLineCount: 2 }),
      now,
    });
    expect(flags[0]!.ruleId).toBe('deadline.race-against-clock');
    expect(flags[0]!.severity).toBe('danger');
  });

  it('fires warn when under 72h with unpriced lines but past 24h', () => {
    const e = est({ bidDueDate: '2026-04-17' }); // 11:00 UTC → 51h out
    const flags = ruleDeadline({
      estimate: e,
      totals: totals({ unpricedLineCount: 1 }),
      now,
    });
    expect(flags[0]!.ruleId).toBe('deadline.tight');
    expect(flags[0]!.severity).toBe('warn');
  });

  it('does not fire when fully priced even close to deadline', () => {
    const e = est({ bidDueDate: '2026-04-15' });
    expect(
      ruleDeadline({ estimate: e, totals: totals(), now }),
    ).toEqual([]);
  });
});

describe('runBidCoach', () => {
  const now = new Date('2026-04-15T08:00:00Z');

  it('aggregates flags across rules and sorts danger first', () => {
    const inputs: BidCoachInputs = {
      estimate: est({
        bidDueDate: '2026-04-15',
        addenda: [{ id: 'add-1', number: '1', acknowledged: false }],
      }),
      totals: totals({ unpricedLineCount: 2 }),
      now,
    };
    const flags = runBidCoach(inputs);
    expect(flags.length).toBeGreaterThan(1);
    // First flag must be danger
    expect(flags[0]!.severity).toBe('danger');
    // No info follows danger before all dangers are listed
    const sevSeq = flags.map((f) => f.severity);
    expect(sevSeq.indexOf('warn')).toBeGreaterThan(sevSeq.lastIndexOf('danger'));
  });

  it('preserves dismissed flags but annotates them', () => {
    const inputs: BidCoachInputs = {
      estimate: est({
        addenda: [{ id: 'add-1', number: '1', acknowledged: false }],
      }),
      totals: totals(),
      now,
      dismissals: new Map([
        ['pe-aaaaaaaa/contract.unacked-addendum/add-1', { dismissedAt: '2026-04-15T08:30:00Z', reason: 'Verbal ack via email confirmed' }],
      ]),
    };
    const flags = runBidCoach(inputs);
    const ack = flags.find((f) => f.ruleId === 'contract.unacked-addendum');
    expect(ack).toBeDefined();
    expect(ack!.dismissedAt).toBe('2026-04-15T08:30:00Z');
    expect(ack!.dismissedReason).toBe('Verbal ack via email confirmed');
  });
});

describe('summarizeBidCoach', () => {
  it('rolls up totals + active count + blocking count + cleanToSubmit', () => {
    const inputs: BidCoachInputs = {
      estimate: est({
        addenda: [{ id: 'add-1', number: '1', acknowledged: false }],
      }),
      totals: totals({ unpricedLineCount: 1 }),
      now: new Date('2026-04-15T08:00:00Z'),
      dismissals: new Map([
        ['pe-aaaaaaaa/contract.unacked-addendum/add-1', { dismissedAt: '2026-04-15T08:30:00Z', reason: 'ok' }],
      ]),
    };
    const flags = runBidCoach(inputs);
    const r = summarizeBidCoach(flags);
    expect(r.total).toBeGreaterThan(0);
    expect(r.activeCount).toBeLessThan(r.total); // dismissed addendum not active
    expect(r.blockingCount).toBeGreaterThan(0); // unpriced lines still danger
    expect(r.cleanToSubmit).toBe(false);
  });

  it('cleanToSubmit is true when only info-level (or no) flags fire', () => {
    const r = summarizeBidCoach([]);
    expect(r.cleanToSubmit).toBe(true);
  });
});
