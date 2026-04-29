// Portfolio cash net year-over-year.
//
// Plain English: collapse two years of AR receipts and non-
// voided AP payments into a single comparison. Sized for the
// year-end "did the company net positive cash?" review.
//
// Different from portfolio-cash-net-monthly (per month).
//
// Pure derivation. No persisted records.

import type { ApPayment } from './ap-payment';
import type { ArPayment } from './ar-payment';

export interface PortfolioCashNetYoyResult {
  priorYear: number;
  currentYear: number;
  priorReceiptsCents: number;
  priorPaymentsCents: number;
  priorNetCents: number;
  currentReceiptsCents: number;
  currentPaymentsCents: number;
  currentNetCents: number;
  netCentsDelta: number;
  voidedSkipped: number;
}

export interface PortfolioCashNetYoyInputs {
  arPayments: ArPayment[];
  apPayments: ApPayment[];
  currentYear: number;
}

export function buildPortfolioCashNetYoy(
  inputs: PortfolioCashNetYoyInputs,
): PortfolioCashNetYoyResult {
  const priorYear = inputs.currentYear - 1;

  let priorReceipts = 0;
  let priorPayments = 0;
  let currentReceipts = 0;
  let currentPayments = 0;
  let voidedSkipped = 0;

  for (const ar of inputs.arPayments) {
    const year = Number(ar.receivedOn.slice(0, 4));
    if (year === priorYear) priorReceipts += ar.amountCents;
    else if (year === inputs.currentYear) currentReceipts += ar.amountCents;
  }

  for (const ap of inputs.apPayments) {
    if (ap.voided) {
      voidedSkipped += 1;
      continue;
    }
    const year = Number(ap.paidOn.slice(0, 4));
    if (year === priorYear) priorPayments += ap.amountCents;
    else if (year === inputs.currentYear) currentPayments += ap.amountCents;
  }

  return {
    priorYear,
    currentYear: inputs.currentYear,
    priorReceiptsCents: priorReceipts,
    priorPaymentsCents: priorPayments,
    priorNetCents: priorReceipts - priorPayments,
    currentReceiptsCents: currentReceipts,
    currentPaymentsCents: currentPayments,
    currentNetCents: currentReceipts - currentPayments,
    netCentsDelta:
      currentReceipts - currentPayments - (priorReceipts - priorPayments),
    voidedSkipped,
  };
}
