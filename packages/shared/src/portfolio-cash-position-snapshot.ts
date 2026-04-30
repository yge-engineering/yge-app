// Portfolio cash position snapshot (point-in-time).
//
// Plain English: as-of date, sum AR receipts and non-voided AP
// payments to date, and surface the cumulative cash net.
// Drives the right-now cash position card on the owner
// dashboard.
//
// Pure derivation. No persisted records.

import type { ApPayment } from './ap-payment';
import type { ArPayment } from './ar-payment';

export interface PortfolioCashPositionSnapshotResult {
  asOf: string;
  receiptsCents: number;
  paymentsCents: number;
  netCents: number;
  receiptCount: number;
  paymentCount: number;
  voidedSkipped: number;
}

export interface PortfolioCashPositionSnapshotInputs {
  arPayments: ArPayment[];
  apPayments: ApPayment[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function buildPortfolioCashPositionSnapshot(
  inputs: PortfolioCashPositionSnapshotInputs,
): PortfolioCashPositionSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  let receiptsCents = 0;
  let receiptCount = 0;
  let paymentsCents = 0;
  let paymentCount = 0;
  let voidedSkipped = 0;

  for (const ar of inputs.arPayments) {
    if (ar.receivedOn > asOf) continue;
    receiptsCents += ar.amountCents;
    receiptCount += 1;
  }

  for (const ap of inputs.apPayments) {
    if (ap.paidOn > asOf) continue;
    if (ap.voided) {
      voidedSkipped += 1;
      continue;
    }
    paymentsCents += ap.amountCents;
    paymentCount += 1;
  }

  return {
    asOf,
    receiptsCents,
    paymentsCents,
    netCents: receiptsCents - paymentsCents,
    receiptCount,
    paymentCount,
    voidedSkipped,
  };
}
