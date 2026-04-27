// AR write-off candidates report.
//
// Plain English: invoices outstanding more than 180 days are usually
// not collectible. Bookkeeper reviews this list quarterly with the
// CPA, decides which to write off (Dr Bad Debt Expense / Cr AR), and
// keeps the books honest.
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';

export type WriteOffTier =
  | 'STALE_180'   // 180-365 days outstanding
  | 'STALE_365'   // 365-730 days
  | 'STALE_730';  // 2+ years — almost certainly write-off

export interface ArWriteOffRow {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  jobId: string;
  invoiceDate: string;
  totalCents: number;
  paidCents: number;
  openCents: number;
  daysOutstanding: number;
  tier: WriteOffTier;
}

export interface ArWriteOffReport {
  asOf: string;
  thresholdDays: number;
  totalCandidatesCents: number;
  rows: ArWriteOffRow[];
  byTier: Record<WriteOffTier, number>;
}

export interface ArWriteOffInputs {
  /** ISO yyyy-mm-dd; defaults to today (UTC). */
  asOf?: string;
  arInvoices: ArInvoice[];
  /** Override the 180-day threshold. */
  thresholdDays?: number;
}

export function buildArWriteOffCandidates(
  inputs: ArWriteOffInputs,
): ArWriteOffReport {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const threshold = inputs.thresholdDays ?? 180;

  const rows: ArWriteOffRow[] = [];
  let totalCents = 0;
  const byTier: Record<WriteOffTier, number> = {
    STALE_180: 0,
    STALE_365: 0,
    STALE_730: 0,
  };

  for (const inv of inputs.arInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'WRITTEN_OFF' || inv.status === 'PAID') continue;
    const open = Math.max(0, inv.totalCents - inv.paidCents);
    if (open === 0) continue;
    const days = daysBetween(inv.invoiceDate, asOf);
    if (days < threshold) continue;
    const tier: WriteOffTier =
      days >= 730 ? 'STALE_730' : days >= 365 ? 'STALE_365' : 'STALE_180';
    rows.push({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customerName: inv.customerName,
      jobId: inv.jobId,
      invoiceDate: inv.invoiceDate,
      totalCents: inv.totalCents,
      paidCents: inv.paidCents,
      openCents: open,
      daysOutstanding: days,
      tier,
    });
    totalCents += open;
    byTier[tier] += 1;
  }

  // Oldest first.
  rows.sort((a, b) => b.daysOutstanding - a.daysOutstanding);

  return {
    asOf,
    thresholdDays: threshold,
    totalCandidatesCents: totalCents,
    rows,
    byTier,
  };
}

function daysBetween(from: string, to: string): number {
  const f = Date.parse(`${from}T00:00:00Z`);
  const t = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(f) || Number.isNaN(t)) return 0;
  return Math.max(0, Math.round((t - f) / (24 * 60 * 60 * 1000)));
}
