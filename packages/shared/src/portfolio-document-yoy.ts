// Portfolio document throughput year-over-year.
//
// Plain English: combine RFI + submittal + PCO + change-order
// + lien-waiver counts into a single two-year comparison.
// Drives the year-end office-throughput executive summary.
//
// Different from portfolio-document-monthly (per month).
//
// Pure derivation. No persisted records.

import type { ChangeOrder } from './change-order';
import type { LienWaiver } from './lien-waiver';
import type { Pco } from './pco';
import type { Rfi } from './rfi';
import type { Submittal } from './submittal';

export interface PortfolioDocumentYoyResult {
  priorYear: number;
  currentYear: number;
  priorRfis: number;
  priorSubmittals: number;
  priorPcos: number;
  priorChangeOrders: number;
  priorLienWaivers: number;
  priorTotal: number;
  currentRfis: number;
  currentSubmittals: number;
  currentPcos: number;
  currentChangeOrders: number;
  currentLienWaivers: number;
  currentTotal: number;
  totalDelta: number;
}

export interface PortfolioDocumentYoyInputs {
  rfis: Rfi[];
  submittals: Submittal[];
  pcos: Pco[];
  changeOrders: ChangeOrder[];
  lienWaivers: LienWaiver[];
  currentYear: number;
}

export function buildPortfolioDocumentYoy(
  inputs: PortfolioDocumentYoyInputs,
): PortfolioDocumentYoyResult {
  const priorYear = inputs.currentYear - 1;

  let priorRfis = 0;
  let currentRfis = 0;
  for (const r of inputs.rfis) {
    if (!r.sentAt) continue;
    const y = Number(r.sentAt.slice(0, 4));
    if (y === priorYear) priorRfis += 1;
    else if (y === inputs.currentYear) currentRfis += 1;
  }

  let priorSubmittals = 0;
  let currentSubmittals = 0;
  for (const s of inputs.submittals) {
    if (!s.submittedAt) continue;
    const y = Number(s.submittedAt.slice(0, 4));
    if (y === priorYear) priorSubmittals += 1;
    else if (y === inputs.currentYear) currentSubmittals += 1;
  }

  let priorPcos = 0;
  let currentPcos = 0;
  for (const p of inputs.pcos) {
    const y = Number(p.noticedOn.slice(0, 4));
    if (y === priorYear) priorPcos += 1;
    else if (y === inputs.currentYear) currentPcos += 1;
  }

  let priorChangeOrders = 0;
  let currentChangeOrders = 0;
  for (const co of inputs.changeOrders) {
    if (!co.proposedAt) continue;
    const y = Number(co.proposedAt.slice(0, 4));
    if (y === priorYear) priorChangeOrders += 1;
    else if (y === inputs.currentYear) currentChangeOrders += 1;
  }

  let priorLienWaivers = 0;
  let currentLienWaivers = 0;
  for (const lw of inputs.lienWaivers) {
    const y = Number(lw.throughDate.slice(0, 4));
    if (y === priorYear) priorLienWaivers += 1;
    else if (y === inputs.currentYear) currentLienWaivers += 1;
  }

  const priorTotal =
    priorRfis + priorSubmittals + priorPcos + priorChangeOrders + priorLienWaivers;
  const currentTotal =
    currentRfis +
    currentSubmittals +
    currentPcos +
    currentChangeOrders +
    currentLienWaivers;

  return {
    priorYear,
    currentYear: inputs.currentYear,
    priorRfis,
    priorSubmittals,
    priorPcos,
    priorChangeOrders,
    priorLienWaivers,
    priorTotal,
    currentRfis,
    currentSubmittals,
    currentPcos,
    currentChangeOrders,
    currentLienWaivers,
    currentTotal,
    totalDelta: currentTotal - priorTotal,
  };
}
