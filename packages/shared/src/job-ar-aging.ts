// Per-job AR aging snapshot.
//
// Plain English: customer-open-ar gives the per-customer aging
// view. This module flips it per AWARDED job — what does the AR
// pile look like for THIS specific project? Useful for the
// project-detail page header and pre-billing reviews.
//
// Per row:
//   - open invoice count + outstanding $
//   - oldest open invoice date + days since
//   - count of invoices in each aging bucket (0-30 / 31-60 /
//     61-90 / 90+ days past effective due date)
//   - worst bucket flag (drives alert color)
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';
import type { Job } from './job';

export type JobArAgingBucket = '0-30' | '31-60' | '61-90' | '90+';

export interface JobArAgingRow {
  jobId: string;
  projectName: string;
  openInvoiceCount: number;
  totalOutstandingCents: number;
  oldestInvoiceDate: string | null;
  daysSinceOldest: number | null;
  bucket0to30Count: number;
  bucket31to60Count: number;
  bucket61to90Count: number;
  bucket90PlusCount: number;
  worstBucket: JobArAgingBucket | null;
}

export interface JobArAgingRollup {
  jobsConsidered: number;
  totalOpenInvoices: number;
  totalOutstandingCents: number;
  jobsWithDangerBucket: number;
}

export interface JobArAgingInputs {
  asOf?: string;
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  arInvoices: ArInvoice[];
  /** When false (default), only AWARDED jobs are scored. */
  includeAllStatuses?: boolean;
}

export function buildJobArAging(inputs: JobArAgingInputs): {
  rollup: JobArAgingRollup;
  rows: JobArAgingRow[];
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const refNow = new Date(`${asOf}T00:00:00Z`);
  const includeAll = inputs.includeAllStatuses === true;

  const byJob = new Map<string, ArInvoice[]>();
  for (const inv of inputs.arInvoices) {
    if (
      inv.status === 'DRAFT' ||
      inv.status === 'PAID' ||
      inv.status === 'WRITTEN_OFF'
    ) continue;
    const open = Math.max(0, inv.totalCents - inv.paidCents);
    if (open <= 0) continue;
    const list = byJob.get(inv.jobId) ?? [];
    list.push(inv);
    byJob.set(inv.jobId, list);
  }

  const rows: JobArAgingRow[] = [];
  let totalOpenInvoices = 0;
  let totalOutstanding = 0;
  let dangerJobs = 0;

  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const invs = byJob.get(j.id) ?? [];
    let outstanding = 0;
    let oldest: string | null = null;
    let b0 = 0;
    let b31 = 0;
    let b61 = 0;
    let b90 = 0;

    for (const inv of invs) {
      const open = Math.max(0, inv.totalCents - inv.paidCents);
      outstanding += open;
      if (!oldest || inv.invoiceDate < oldest) oldest = inv.invoiceDate;

      const sentDate = parseDate(inv.invoiceDate);
      if (!sentDate) continue;
      const due = inv.dueDate ? parseDate(inv.dueDate) : null;
      const effectiveDue = due ?? new Date(
        sentDate.getTime() + 30 * 24 * 60 * 60 * 1000,
      );
      const daysOverdue = Math.max(0, daysBetween(effectiveDue, refNow));
      if (daysOverdue <= 30) b0 += 1;
      else if (daysOverdue <= 60) b31 += 1;
      else if (daysOverdue <= 90) b61 += 1;
      else b90 += 1;
    }

    let worst: JobArAgingBucket | null = null;
    if (invs.length > 0) {
      if (b90 > 0) worst = '90+';
      else if (b61 > 0) worst = '61-90';
      else if (b31 > 0) worst = '31-60';
      else worst = '0-30';
    }

    let oldestParsed: Date | null = null;
    let daysSinceOldest: number | null = null;
    if (oldest) {
      oldestParsed = parseDate(oldest);
      if (oldestParsed) daysSinceOldest = Math.max(0, daysBetween(oldestParsed, refNow));
    }

    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      openInvoiceCount: invs.length,
      totalOutstandingCents: outstanding,
      oldestInvoiceDate: oldest,
      daysSinceOldest,
      bucket0to30Count: b0,
      bucket31to60Count: b31,
      bucket61to90Count: b61,
      bucket90PlusCount: b90,
      worstBucket: worst,
    });
    totalOpenInvoices += invs.length;
    totalOutstanding += outstanding;
    if (b90 > 0) dangerJobs += 1;
  }

  // Worst bucket first; daysSinceOldest desc within tier.
  const tierRank: Record<JobArAgingBucket | 'NONE', number> = {
    '90+': 0,
    '61-90': 1,
    '31-60': 2,
    '0-30': 3,
    NONE: 4,
  };
  rows.sort((a, b) => {
    const aRank = a.worstBucket ?? 'NONE';
    const bRank = b.worstBucket ?? 'NONE';
    if (aRank !== bRank) return tierRank[aRank] - tierRank[bRank];
    return (b.daysSinceOldest ?? -1) - (a.daysSinceOldest ?? -1);
  });

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalOpenInvoices,
      totalOutstandingCents: totalOutstanding,
      jobsWithDangerBucket: dangerJobs,
    },
    rows,
  };
}

function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}
