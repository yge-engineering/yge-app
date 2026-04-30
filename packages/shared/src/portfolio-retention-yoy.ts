// Portfolio retention year-over-year (year-end snapshot).
//
// Plain English: take a year-end (Dec 31) snapshot of retention
// held vs released for prior + current year. Sized for the
// lender's "what's still being held back at year-end" review.
//
// Different from portfolio-retention-monthly (per month).
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';

export interface PortfolioRetentionYoyBucket {
  heldCents: number;
  releasedCents: number;
  netHeldCents: number;
  invoiceCount: number;
}

export interface PortfolioRetentionYoyResult {
  priorYear: number;
  currentYear: number;
  prior: PortfolioRetentionYoyBucket;
  current: PortfolioRetentionYoyBucket;
  netHeldCentsDelta: number;
}

export interface PortfolioRetentionYoyInputs {
  arInvoices: ArInvoice[];
  arPayments: ArPayment[];
  currentYear: number;
}

function snapshot(
  invoices: ArInvoice[],
  payments: ArPayment[],
  asOf: string,
): PortfolioRetentionYoyBucket {
  let heldCents = 0;
  let releasedCents = 0;
  let invoiceCount = 0;

  for (const inv of invoices) {
    if (inv.invoiceDate > asOf) continue;
    const ret = inv.retentionCents ?? 0;
    if (ret <= 0) continue;
    heldCents += ret;
    invoiceCount += 1;
  }
  for (const p of payments) {
    if (p.kind !== 'RETENTION_RELEASE') continue;
    if (p.receivedOn > asOf) continue;
    releasedCents += p.amountCents;
  }

  return {
    heldCents,
    releasedCents,
    netHeldCents: Math.max(0, heldCents - releasedCents),
    invoiceCount,
  };
}

export function buildPortfolioRetentionYoy(
  inputs: PortfolioRetentionYoyInputs,
): PortfolioRetentionYoyResult {
  const priorYear = inputs.currentYear - 1;
  const prior = snapshot(inputs.arInvoices, inputs.arPayments, `${priorYear}-12-31`);
  const current = snapshot(inputs.arInvoices, inputs.arPayments, `${inputs.currentYear}-12-31`);
  return {
    priorYear,
    currentYear: inputs.currentYear,
    prior,
    current,
    netHeldCentsDelta: current.netHeldCents - prior.netHeldCents,
  };
}
