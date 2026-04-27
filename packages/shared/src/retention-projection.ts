// AR retention release projection.
//
// Plain English: every public-works job holds 5-10% retention until
// after substantial completion + a punch-list walkthrough. PCC §7107
// requires the agency to release retention within 60 days of
// completion notice. This walks every job that has retention held
// and projects when that money should land back in YGE's account.
//
// Pure derivation. No persisted records.
//
// Bucketing relative to the projected release date:
//   - DUE_NOW: release date is today or earlier (overdue release)
//   - DUE_30: 1-30 days out
//   - DUE_60: 31-60 days out
//   - DUE_90: 61-90 days out
//   - LATER: 91+ days out
//   - NO_DATE: no completion-notice date on file (unknown timing)

import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';

export type RetentionReleaseBucket =
  | 'DUE_NOW'
  | 'DUE_30'
  | 'DUE_60'
  | 'DUE_90'
  | 'LATER'
  | 'NO_DATE';

export interface RetentionProjectionRow {
  jobId: string;
  customerName: string;
  retentionHeldCents: number;
  retentionReleasedCents: number;
  /** held - released. */
  outstandingRetentionCents: number;
  /** Most recent invoice date — best proxy for "latest billed work"
   *  in absence of a completion notice. */
  lastInvoiceDate: string | null;
  /** Caller-supplied completion-notice date (yyyy-mm-dd) when known. */
  completionNoticeDate: string | null;
  /** completionNoticeDate + 60 days, when known. */
  expectedReleaseDate: string | null;
  /** Days from asOf to expectedReleaseDate. Negative = overdue. */
  daysToRelease: number | null;
  bucket: RetentionReleaseBucket;
}

export interface RetentionProjectionRollup {
  totalOutstandingCents: number;
  byBucket: Record<RetentionReleaseBucket, number>;
}

export interface RetentionProjectionInputs {
  /** ISO yyyy-mm-dd; defaults to today (UTC). */
  asOf?: string;
  arInvoices: ArInvoice[];
  arPayments: ArPayment[];
  /** Optional Map<jobId, completionNoticeDate yyyy-mm-dd>. When the
   *  caller knows the completion-notice date, we can project a real
   *  release date; otherwise the row falls into NO_DATE. */
  completionNoticeByJobId?: Map<string, string>;
  /** Optional Map<jobId, customerName> for friendlier display. Falls
   *  back to the customerName on the most recent AR invoice. */
  customerNameByJobId?: Map<string, string>;
}

export function buildRetentionProjection(
  inputs: RetentionProjectionInputs,
): {
  rows: RetentionProjectionRow[];
  rollup: RetentionProjectionRollup;
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const completionByJob = inputs.completionNoticeByJobId ?? new Map();
  const customerByJob = inputs.customerNameByJobId ?? new Map();

  // Tally retention HELD per job from AR invoices.
  type Bucket = {
    held: number;
    released: number;
    lastInvoiceDate: string | null;
    customerName: string;
  };
  const byJob = new Map<string, Bucket>();

  for (const inv of inputs.arInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'WRITTEN_OFF') continue;
    const ret = inv.retentionCents ?? 0;
    if (ret === 0) continue;
    const b =
      byJob.get(inv.jobId) ??
      ({
        held: 0,
        released: 0,
        lastInvoiceDate: null,
        customerName: inv.customerName,
      } as Bucket);
    b.held += ret;
    if (
      !b.lastInvoiceDate ||
      inv.invoiceDate > b.lastInvoiceDate
    ) {
      b.lastInvoiceDate = inv.invoiceDate;
      b.customerName = inv.customerName;
    }
    byJob.set(inv.jobId, b);
  }

  // Apply RETENTION_RELEASE payments per job.
  for (const p of inputs.arPayments) {
    if (p.kind !== 'RETENTION_RELEASE') continue;
    const b = byJob.get(p.jobId);
    if (!b) continue;
    b.released += p.amountCents;
  }

  const rows: RetentionProjectionRow[] = [];
  const byBucket: Record<RetentionReleaseBucket, number> = {
    DUE_NOW: 0,
    DUE_30: 0,
    DUE_60: 0,
    DUE_90: 0,
    LATER: 0,
    NO_DATE: 0,
  };
  let totalOutstandingCents = 0;

  for (const [jobId, b] of byJob) {
    const outstanding = Math.max(0, b.held - b.released);
    if (outstanding === 0) continue;

    const completion = completionByJob.get(jobId) ?? null;
    const expectedRelease = completion ? addDays(completion, 60) : null;
    const daysToRelease = expectedRelease
      ? daysBetween(asOf, expectedRelease)
      : null;

    let bucket: RetentionReleaseBucket;
    if (!daysToRelease && daysToRelease !== 0) bucket = 'NO_DATE';
    else if (daysToRelease <= 0) bucket = 'DUE_NOW';
    else if (daysToRelease <= 30) bucket = 'DUE_30';
    else if (daysToRelease <= 60) bucket = 'DUE_60';
    else if (daysToRelease <= 90) bucket = 'DUE_90';
    else bucket = 'LATER';

    rows.push({
      jobId,
      customerName: customerByJob.get(jobId) ?? b.customerName,
      retentionHeldCents: b.held,
      retentionReleasedCents: b.released,
      outstandingRetentionCents: outstanding,
      lastInvoiceDate: b.lastInvoiceDate,
      completionNoticeDate: completion,
      expectedReleaseDate: expectedRelease,
      daysToRelease,
      bucket,
    });

    totalOutstandingCents += outstanding;
    byBucket[bucket] += outstanding;
  }

  // Sort: DUE_NOW first (most overdue first within), then 30/60/90,
  // then LATER, NO_DATE last.
  const tierRank: Record<RetentionReleaseBucket, number> = {
    DUE_NOW: 0,
    DUE_30: 1,
    DUE_60: 2,
    DUE_90: 3,
    LATER: 4,
    NO_DATE: 5,
  };
  rows.sort((a, b) => {
    if (a.bucket !== b.bucket) return tierRank[a.bucket] - tierRank[b.bucket];
    if (a.bucket === 'DUE_NOW') {
      // Most negative daysToRelease first (most overdue).
      return (a.daysToRelease ?? 0) - (b.daysToRelease ?? 0);
    }
    if (a.daysToRelease != null && b.daysToRelease != null) {
      return a.daysToRelease - b.daysToRelease;
    }
    return b.outstandingRetentionCents - a.outstandingRetentionCents;
  });

  return {
    rows,
    rollup: {
      totalOutstandingCents,
      byBucket,
    },
  };
}

function addDays(d: string, n: number): string {
  const t = Date.parse(`${d}T00:00:00Z`);
  if (Number.isNaN(t)) return d;
  return new Date(t + n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const f = Date.parse(`${from}T00:00:00Z`);
  const t = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(f) || Number.isNaN(t)) return 0;
  return Math.round((t - f) / (24 * 60 * 60 * 1000));
}
