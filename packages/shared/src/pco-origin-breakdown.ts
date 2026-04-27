// PCO origin breakdown.
//
// Plain English: of all the PCOs YGE has raised, what fraction come
// from owner-directed work, design changes, unforeseen conditions,
// RFI responses, spec conflicts, weather, or other? When the
// design-change number is high, it's a story to tell the engineer.
// When unforeseen-condition is high, it's a story for the bid team
// (we should have caught it).
//
// Pure derivation. No persisted records.

import type { Pco, PcoOrigin } from './pco';

export interface PcoOriginRow {
  origin: PcoOrigin;
  count: number;
  totalCostImpactCents: number;
  shareOfCount: number;
  shareOfDollars: number;
}

export interface PcoOriginBreakdownReport {
  totalPcos: number;
  totalCostImpactCents: number;
  rows: PcoOriginRow[];
}

export interface PcoOriginBreakdownInputs {
  pcos: Pco[];
  /** Optional date range on noticedOn. */
  start?: string;
  end?: string;
  /** When true, includes WITHDRAWN PCOs. Default false. */
  includeWithdrawn?: boolean;
}

export function buildPcoOriginBreakdown(
  inputs: PcoOriginBreakdownInputs,
): PcoOriginBreakdownReport {
  const { pcos, start, end } = inputs;
  const includeWithdrawn = inputs.includeWithdrawn === true;

  const filtered = pcos.filter((p) => {
    if (!includeWithdrawn && p.status === 'WITHDRAWN') return false;
    if (start && p.noticedOn < start) return false;
    if (end && p.noticedOn > end) return false;
    return true;
  });

  type Bucket = { count: number; cost: number };
  const byOrigin = new Map<PcoOrigin, Bucket>();
  let totalCost = 0;
  for (const p of filtered) {
    const b = byOrigin.get(p.origin) ?? { count: 0, cost: 0 };
    b.count += 1;
    b.cost += p.costImpactCents;
    byOrigin.set(p.origin, b);
    totalCost += p.costImpactCents;
  }

  const rows: PcoOriginRow[] = [];
  for (const [origin, b] of byOrigin) {
    rows.push({
      origin,
      count: b.count,
      totalCostImpactCents: b.cost,
      shareOfCount: filtered.length === 0 ? 0 : b.count / filtered.length,
      shareOfDollars: totalCost === 0 ? 0 : b.cost / totalCost,
    });
  }
  // Highest dollar impact first.
  rows.sort((a, b) => b.totalCostImpactCents - a.totalCostImpactCents);

  return {
    totalPcos: filtered.length,
    totalCostImpactCents: totalCost,
    rows,
  };
}
