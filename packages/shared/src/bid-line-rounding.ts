// Bid-line unit-price rounding.
//
// CalTrans + most county bid tabs read better when YGE submits round
// numbers (nearest $5 or nearest $10) — fewer typos transcribing into
// the bid form, easier to compare against the engineer's estimate at
// a glance. This helper rounds a PricedEstimate's unit prices to a
// caller-supplied increment without touching unrelated fields.
//
// Pure function. The estimator presses "Round to $5" on the editor
// and reviews — they always retain the right to override per line.

import type { PricedBidItem, PricedEstimate } from './priced-estimate';

export type RoundingDirection = 'NEAREST' | 'UP' | 'DOWN';

export interface RoundLinesInput {
  estimate: PricedEstimate;
  /** Increment in cents. e.g. 500 = nearest $5. Must be > 0. */
  incrementCents: number;
  /** Rounding direction. NEAREST = standard banker-style nearest;
   *  UP = always ceil (covers risk on the bid); DOWN = always floor
   *  (more aggressive pricing). Default NEAREST. */
  direction?: RoundingDirection;
  /** When true, items whose AI-supplied estimatedUnitPriceCents was
   *  already on the increment stay untouched (small risk: a non-
   *  rounded number that happens to land on the increment will get
   *  marked "unchanged" too — rare and harmless). Default false. */
  preserveOnIncrement?: boolean;
}

export interface RoundedLineDiff {
  itemNumber: string;
  beforeCents: number | null;
  afterCents: number | null;
  /** Diff in cents (after - before). Null when no change happened. */
  deltaCents: number | null;
}

export interface RoundLinesResult {
  /** New bid items with rounded unit prices. Line totals (when
   *  present) are NOT recomputed here — the estimator's editor
   *  recomputes after the round-and-review pass, so we don't
   *  double-write the cached field. */
  items: PricedBidItem[];
  /** Diff summary per line for the UI "review changes" panel. Only
   *  rows where the value changed are returned. */
  diffs: RoundedLineDiff[];
  /** Sum of unit-price deltas across all changed lines. Useful for
   *  "this rounding shifted the bid by ±$N" preview. */
  totalDeltaCents: number;
}

function roundTo(cents: number, increment: number, dir: RoundingDirection): number {
  if (increment <= 0) {
    throw new Error('roundTo: increment must be > 0');
  }
  const ratio = cents / increment;
  let r: number;
  switch (dir) {
    case 'UP':
      r = Math.ceil(ratio);
      break;
    case 'DOWN':
      r = Math.floor(ratio);
      break;
    case 'NEAREST':
    default:
      r = Math.round(ratio);
      break;
  }
  return r * increment;
}

export function roundBidLines(input: RoundLinesInput): RoundLinesResult {
  const { estimate, incrementCents } = input;
  if (incrementCents <= 0) {
    throw new Error('roundBidLines: incrementCents must be > 0');
  }
  const direction = input.direction ?? 'NEAREST';
  const preserve = input.preserveOnIncrement ?? false;

  const diffs: RoundedLineDiff[] = [];
  let totalDelta = 0;

  const items: PricedBidItem[] = estimate.bidItems.map((item) => {
    const current = item.unitPriceCents;
    if (current == null) return item;
    if (preserve && current % incrementCents === 0) return item;
    const rounded = roundTo(current, incrementCents, direction);
    if (rounded === current) return item;
    diffs.push({
      itemNumber: item.itemNumber,
      beforeCents: current,
      afterCents: rounded,
      deltaCents: rounded - current,
    });
    totalDelta += rounded - current;
    return { ...item, unitPriceCents: rounded };
  });

  return { items, diffs, totalDeltaCents: totalDelta };
}
