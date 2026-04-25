import { describe, expect, it } from 'vitest';
import {
  computeEstimateTotals,
  lineExtendedCents,
  blankPricedItemsFromDraft,
  type PricedBidItem,
  type PricedEstimate,
} from './priced-estimate';

function priced(quantity: number, unitPriceCents: number | null): PricedBidItem {
  return {
    itemNumber: '1',
    description: 'Test',
    unit: 'EA',
    quantity,
    confidence: 'HIGH',
    unitPriceCents,
  };
}

function estimate(items: PricedBidItem[], oppPercent = 0.2): PricedEstimate {
  return {
    id: 'e1',
    fromDraftId: 'd1',
    jobId: 'cltest000000000000000000',
    createdAt: '2026-04-24T00:00:00Z',
    updatedAt: '2026-04-24T00:00:00Z',
    projectName: 'Test',
    projectType: 'OTHER',
    bidItems: items,
    oppPercent,
  };
}

describe('lineExtendedCents', () => {
  it('returns 0 when unit price is null', () => {
    expect(lineExtendedCents(priced(10, null))).toBe(0);
  });

  it('multiplies quantity by unit price', () => {
    expect(lineExtendedCents(priced(10, 5_00))).toBe(50_00); // 10 * $5.00 = $50.00
  });

  it('rounds fractional quantities to whole cents', () => {
    // 0.333 * 1234 cents = 410.922 → 411
    expect(lineExtendedCents(priced(0.333, 1234))).toBe(411);
  });

  it('handles zero quantity', () => {
    expect(lineExtendedCents(priced(0, 100_00))).toBe(0);
  });
});

describe('computeEstimateTotals', () => {
  it('sums extended lines, applies O&P, computes total', () => {
    const e = estimate(
      [priced(10, 100), priced(5, 200)], // $1.00 + $1.00 = $2.00 direct
      0.2,                                // 20% O&P → $0.40
    );
    const t = computeEstimateTotals(e);
    expect(t.directCents).toBe(2_00);
    expect(t.oppCents).toBe(40);
    expect(t.bidTotalCents).toBe(2_40);
    expect(t.unpricedLineCount).toBe(0);
  });

  it('counts unpriced lines without dragging totals down', () => {
    const e = estimate([
      priced(10, 100),       // priced
      priced(2, null),       // not priced
      priced(1, null),       // not priced
    ]);
    const t = computeEstimateTotals(e);
    // Only the priced line contributes: 10 * 100 cents = 1000 cents ($10.00).
    expect(t.directCents).toBe(1_000);
    expect(t.unpricedLineCount).toBe(2);
  });

  it('handles 0% O&P', () => {
    const e = estimate([priced(1, 1_000_00)], 0);
    const t = computeEstimateTotals(e);
    expect(t.directCents).toBe(1_000_00);
    expect(t.oppCents).toBe(0);
    expect(t.bidTotalCents).toBe(1_000_00);
  });

  it('handles fully unpriced estimate', () => {
    const e = estimate([priced(5, null), priced(10, null)]);
    const t = computeEstimateTotals(e);
    expect(t.directCents).toBe(0);
    expect(t.oppCents).toBe(0);
    expect(t.bidTotalCents).toBe(0);
    expect(t.unpricedLineCount).toBe(2);
  });
});

describe('blankPricedItemsFromDraft', () => {
  it('clones bid items with null unit prices', () => {
    const draftItems = [
      {
        itemNumber: 'A1',
        description: 'Asphalt',
        unit: 'TON',
        quantity: 50,
        confidence: 'HIGH' as const,
      },
    ];
    const out = blankPricedItemsFromDraft(draftItems);
    expect(out).toHaveLength(1);
    expect(out[0].itemNumber).toBe('A1');
    expect(out[0].quantity).toBe(50);
    expect(out[0].unitPriceCents).toBeNull();
  });

  it('preserves optional fields when present', () => {
    const draftItems = [
      {
        itemNumber: 'A1',
        description: 'Asphalt',
        unit: 'TON',
        quantity: 50,
        confidence: 'MEDIUM' as const,
        notes: 'Priced per CalTrans 2024 average',
        pageReference: 'p. 12',
      },
    ];
    const out = blankPricedItemsFromDraft(draftItems);
    expect(out[0].notes).toBe('Priced per CalTrans 2024 average');
    expect(out[0].pageReference).toBe('p. 12');
  });
});
