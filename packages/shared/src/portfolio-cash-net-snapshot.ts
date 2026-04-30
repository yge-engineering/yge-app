// Portfolio cash net snapshot.
//
// Plain English: as-of today, sum AR receipts (cash in) minus
// AP disbursements (cash out, ex voided) for both cumulative
// + YTD windows. Drives the right-now net-cash overview.
//
// Pure derivation. No persisted records.

import type { ApPayment } from './ap-payment';
import type { ArPayment } from './ar-payment';

export interface PortfolioCashNetSnapshotResult {
  asOf: string;
  ytdLogYear: number;
  totalReceiptsCents: number;
  totalDisbursementsCents: number;
  netCents: number;
  ytdReceiptsCents: number;
  ytdDisbursementsCents: number;
  ytdNetCents: number;
}

export interface PortfolioCashNetSnapshotInputs {
  arPayments: ArPayment[];
  apPayments: ApPayment[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
  /** Log year (Jan 1 - Dec 31). Defaults to year of asOf. */
  logYear?: number;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function buildPortfolioCashNetSnapshot(
  inputs: PortfolioCashNetSnapshotInputs,
): PortfolioCashNetSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const logYear = inputs.logYear ?? Number(asOf.slice(0, 4));

  let totalReceiptsCents = 0;
  let ytdReceiptsCents = 0;
  for (const p of inputs.arPayments) {
    if (p.receivedOn > asOf) continue;
    totalReceiptsCents += p.amountCents;
    if (Number(p.receivedOn.slice(0, 4)) === logYear) ytdReceiptsCents += p.amountCents;
  }

  let totalDisbursementsCents = 0;
  let ytdDisbursementsCents = 0;
  for (const p of inputs.apPayments) {
    if (p.paidOn > asOf) continue;
    if (p.voided) continue;
    totalDisbursementsCents += p.amountCents;
    if (Number(p.paidOn.slice(0, 4)) === logYear) ytdDisbursementsCents += p.amountCents;
  }

  return {
    asOf,
    ytdLogYear: logYear,
    totalReceiptsCents,
    totalDisbursementsCents,
    netCents: totalReceiptsCents - totalDisbursementsCents,
    ytdReceiptsCents,
    ytdDisbursementsCents,
    ytdNetCents: ytdReceiptsCents - ytdDisbursementsCents,
  };
}
