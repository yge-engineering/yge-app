// Estimate roll-up math. Mirrors the Excel model's subtotal + grand-total
// behavior so v5.3 xlsx and the app produce identical numbers given the same
// inputs.

import type { Cents } from './money';
import { markupAmount } from './money';

export interface CostLineInput {
  extendedCents: Cents; // already extended per rates.extendLaborCost or equivalent
}

export interface BidItemInput {
  lines: CostLineInput[];
}

export interface EstimateInput {
  bidItems: BidItemInput[];
  oppPercent: number; // e.g. 0.20 for 20%
}

export interface BidItemRollup {
  directCents: Cents;
  oppCents: Cents;
  bidCents: Cents;
}

export interface EstimateRollup {
  bidItems: BidItemRollup[];
  directCents: Cents;
  oppCents: Cents;
  bidCents: Cents;
}

export function rollupBidItem(item: BidItemInput, oppPercent: number): BidItemRollup {
  const directCents = item.lines.reduce((sum, l) => sum + l.extendedCents, 0);
  const oppCents = markupAmount(directCents, oppPercent);
  return {
    directCents,
    oppCents,
    bidCents: directCents + oppCents,
  };
}

export function rollupEstimate(est: EstimateInput): EstimateRollup {
  const bidItems = est.bidItems.map((i) => rollupBidItem(i, est.oppPercent));
  const directCents = bidItems.reduce((s, b) => s + b.directCents, 0);
  const oppCents = bidItems.reduce((s, b) => s + b.oppCents, 0);
  return {
    bidItems,
    directCents,
    oppCents,
    bidCents: directCents + oppCents,
  };
}
