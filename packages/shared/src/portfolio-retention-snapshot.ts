// Portfolio retention snapshot (point-in-time).
//
// Plain English: as-of date, sum every AR invoice's
// retentionCents and subtract RETENTION_RELEASE payments
// already received. Drives the right-now retention exposure
// overview.
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';

export interface PortfolioRetentionSnapshotResult {
  asOf: string;
  heldCents: number;
  releasedCents: number;
  netHeldCents: number;
  invoiceCount: number;
  distinctJobs: number;
}

export interface PortfolioRetentionSnapshotInputs {
  arInvoices: ArInvoice[];
  arPayments: ArPayment[];
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

export function buildPortfolioRetentionSnapshot(
  inputs: PortfolioRetentionSnapshotInputs,
): PortfolioRetentionSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  let heldCents = 0;
  let releasedCents = 0;
  let invoiceCount = 0;
  const jobs = new Set<string>();

  for (const inv of inputs.arInvoices) {
    if (inv.invoiceDate > asOf) continue;
    const ret = inv.retentionCents ?? 0;
    if (ret <= 0) continue;
    heldCents += ret;
    invoiceCount += 1;
    jobs.add(inv.jobId);
  }
  for (const p of inputs.arPayments) {
    if (p.kind !== 'RETENTION_RELEASE') continue;
    if (p.receivedOn > asOf) continue;
    releasedCents += p.amountCents;
  }

  return {
    asOf,
    heldCents,
    releasedCents,
    netHeldCents: Math.max(0, heldCents - releasedCents),
    invoiceCount,
    distinctJobs: jobs.size,
  };
}
