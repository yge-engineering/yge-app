// PCO-vs-CO negotiation analysis.
//
// Plain English: when a PCO converts to an executed CO, how often
// does the final CO match what YGE proposed? Most of the time the
// agency negotiates down. Walking the history shows how much YGE
// typically "gives up" — by agency contact, useful for setting
// realistic expectations on the next ask.
//
// Pure derivation. Joins Pco.changeOrderId → ChangeOrder.id.

import type { ChangeOrder } from './change-order';
import type { Pco } from './pco';

export interface PcoCoVarianceRow {
  pcoId: string;
  changeOrderId: string;
  jobId: string;
  agencyContact: string;
  proposedCents: number;
  executedCents: number;
  /** executed - proposed. Negative = agency knocked it down. */
  varianceCents: number;
  /** variance / proposed. */
  variancePct: number;
}

export interface PcoCoVarianceReport {
  pairsConsidered: number;
  totalProposedCents: number;
  totalExecutedCents: number;
  totalVarianceCents: number;
  /** variance / proposed across the whole sample. */
  blendedVariancePct: number;
  /** Pairs where executed >= proposed. */
  acceptedAtFullCount: number;
  /** Pairs where executed < proposed. */
  negotiatedDownCount: number;
  rows: PcoCoVarianceRow[];
}

export interface PcoCoVarianceInputs {
  pcos: Pco[];
  changeOrders: ChangeOrder[];
}

export function buildPcoCoVarianceReport(
  inputs: PcoCoVarianceInputs,
): PcoCoVarianceReport {
  const coById = new Map<string, ChangeOrder>();
  for (const co of inputs.changeOrders) {
    if (co.status !== 'EXECUTED') continue;
    coById.set(co.id, co);
  }

  const rows: PcoCoVarianceRow[] = [];
  let totalProposed = 0;
  let totalExecuted = 0;
  let acceptedAtFull = 0;
  let negotiated = 0;

  for (const p of inputs.pcos) {
    if (p.status !== 'CONVERTED_TO_CO') continue;
    if (!p.changeOrderId) continue;
    const co = coById.get(p.changeOrderId);
    if (!co) continue;

    const proposed = p.costImpactCents;
    const executed = co.amountCents;
    const variance = executed - proposed;
    const variancePct =
      proposed === 0 ? 0 : variance / Math.abs(proposed);

    rows.push({
      pcoId: p.id,
      changeOrderId: co.id,
      jobId: p.jobId,
      agencyContact: (p.agencyContact?.trim() || 'Unknown').toString(),
      proposedCents: proposed,
      executedCents: executed,
      varianceCents: variance,
      variancePct: round4(variancePct),
    });

    totalProposed += proposed;
    totalExecuted += executed;
    if (executed >= proposed) acceptedAtFull += 1;
    else negotiated += 1;
  }

  // Worst (most-negative variance) first.
  rows.sort((a, b) => a.varianceCents - b.varianceCents);

  const totalVariance = totalExecuted - totalProposed;
  return {
    pairsConsidered: rows.length,
    totalProposedCents: totalProposed,
    totalExecutedCents: totalExecuted,
    totalVarianceCents: totalVariance,
    blendedVariancePct:
      totalProposed === 0 ? 0 : round4(totalVariance / Math.abs(totalProposed)),
    acceptedAtFullCount: acceptedAtFull,
    negotiatedDownCount: negotiated,
    rows,
  };
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
