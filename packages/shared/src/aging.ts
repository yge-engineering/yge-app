// AR + AP aging report.
//
// Pure derivation. Buckets every open invoice by how many days it is
// past its effective due date and rolls those buckets up by customer
// (AR) or vendor (AP). Same engine, two flavors:
//
//   buildArAgingReport({ asOf, arInvoices })
//   buildApAgingReport({ asOf, apInvoices })
//
// Why this is its own report:
//   - The close-checklist already flags any AR over 60 days as a soft
//     advisory at month-end, but doesn't tell you _which_ customers
//     are dragging or _how much_ is in each bucket. This module does.
//   - Cash forecast looks forward. Aging looks backward — "what's
//     already past due, and who do I have to call?"
//   - For the heavy-civil business specifically: Cal Fire and Caltrans
//     reliably pay in 30-45 days. Anything over 60 means a payment
//     packet got rejected upstream (missing CPR, missing lien waiver,
//     etc.) and Ryan needs to chase it.
//
// Bucket convention — standard four-bucket "current / 30-60 / 60-90
// / 90+" used by every accounting system. Buckets are based on days
// past effective due date:
//
//   '0-30'   — not yet due, OR up to 30 days past due (current)
//   '31-60'  — 31-60 days past due
//   '61-90'  — 61-90 days past due
//   '90+'    — more than 90 days past due  (the danger bucket)
//
// "Effective due date" — if the invoice carries a dueDate, we use it
// straight. If not, we synthesize one as invoiceDate + 30 days, the
// industry-default Net-30 fallback. The synthesized due date is
// returned on the row so the user can see we estimated it.

import type { ApInvoice } from './ap-invoice';
import type { ArInvoice } from './ar-invoice';

/** A single open invoice, bucketed by age. */
export interface AgingRow {
  invoiceId: string;
  invoiceNumber: string;
  partyName: string;        // customer (AR) or vendor (AP)
  /** AR-only — links the invoice back to its job. Undefined for AP. */
  jobId?: string;
  invoiceDate: string;
  /** The date used to compute daysOverdue. Either the invoice's
   *  dueDate field or invoiceDate + 30 if dueDate is missing. */
  effectiveDueDate: string;
  /** True when effectiveDueDate was synthesized because the invoice
   *  didn't have one — surfaced so the UI can mark it. */
  dueDateSynthesized: boolean;

  totalCents: number;
  paidCents: number;
  /** Outstanding balance = totalCents - paidCents. */
  openCents: number;

  /** 0 if not yet due; otherwise calendar days past effectiveDueDate. */
  daysOverdue: number;

  bucket: AgingBucket;
}

export type AgingBucket = '0-30' | '31-60' | '61-90' | '90+';

export const AGING_BUCKETS: readonly AgingBucket[] = [
  '0-30',
  '31-60',
  '61-90',
  '90+',
];

/** Per-party rollup — shows total open and bucket split for one
 *  customer (AR) or vendor (AP). */
export interface AgingPartyRollup {
  partyName: string;
  invoiceCount: number;
  totalOpenCents: number;
  bucket0to30Cents: number;
  bucket31to60Cents: number;
  bucket61to90Cents: number;
  bucket90PlusCents: number;
  /** The single highest daysOverdue across this party's invoices —
   *  drives "who's the worst offender?" sort. */
  oldestDaysOverdue: number;
}

export interface AgingReport {
  /** ISO yyyy-mm-dd the report was computed against. */
  asOf: string;
  rows: AgingRow[];
  byParty: AgingPartyRollup[];
  /** Sum of all openCents across rows. */
  totalOpenCents: number;
  /** Sum of openCents per bucket. */
  bucketTotals: Record<AgingBucket, number>;
  /** Convenience flag — true when any row falls in the 90+ bucket. */
  hasDangerBucket: boolean;
}

export interface ArAgingInputs {
  /** ISO yyyy-mm-dd. */
  asOf: string;
  arInvoices: ArInvoice[];
}

export interface ApAgingInputs {
  /** ISO yyyy-mm-dd. */
  asOf: string;
  apInvoices: ApInvoice[];
}

/** Build the AR aging report — open customer invoices by age bucket.
 *  Skips DRAFT, PAID, WRITTEN_OFF: those are not collectible balances. */
export function buildArAgingReport(inputs: ArAgingInputs): AgingReport {
  const { asOf, arInvoices } = inputs;
  const rows: AgingRow[] = [];

  for (const inv of arInvoices) {
    if (inv.status === 'DRAFT') continue;
    if (inv.status === 'PAID') continue;
    if (inv.status === 'WRITTEN_OFF') continue;

    const open = Math.max(0, inv.totalCents - inv.paidCents);
    if (open === 0) continue;

    const eff = effectiveDueDate(inv.dueDate, inv.invoiceDate);
    const daysOverdue = daysBetween(eff.dueDate, asOf);
    rows.push({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      partyName: inv.customerName,
      jobId: inv.jobId,
      invoiceDate: inv.invoiceDate,
      effectiveDueDate: eff.dueDate,
      dueDateSynthesized: eff.synthesized,
      totalCents: inv.totalCents,
      paidCents: inv.paidCents,
      openCents: open,
      daysOverdue,
      bucket: bucketFor(daysOverdue),
    });
  }

  return assembleReport(rows, asOf);
}

/** Build the AP aging report — open vendor bills by age bucket.
 *  Skips DRAFT, REJECTED, PAID: those aren't liabilities we owe. */
export function buildApAgingReport(inputs: ApAgingInputs): AgingReport {
  const { asOf, apInvoices } = inputs;
  const rows: AgingRow[] = [];

  for (const inv of apInvoices) {
    if (inv.status === 'DRAFT') continue;
    if (inv.status === 'REJECTED') continue;
    if (inv.status === 'PAID') continue;

    const open = Math.max(0, inv.totalCents - inv.paidCents);
    if (open === 0) continue;

    const eff = effectiveDueDate(inv.dueDate, inv.invoiceDate);
    const daysOverdue = daysBetween(eff.dueDate, asOf);
    rows.push({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber ?? inv.id,
      partyName: inv.vendorName,
      // No jobId on AP header — line items can carry it, but at the
      // header level we don't have a single job.
      invoiceDate: inv.invoiceDate,
      effectiveDueDate: eff.dueDate,
      dueDateSynthesized: eff.synthesized,
      totalCents: inv.totalCents,
      paidCents: inv.paidCents,
      openCents: open,
      daysOverdue,
      bucket: bucketFor(daysOverdue),
    });
  }

  return assembleReport(rows, asOf);
}

/** Common assembly — sort rows oldest-first, roll up by party,
 *  compute bucket totals. */
function assembleReport(rows: AgingRow[], asOf: string): AgingReport {
  // Oldest first — the call list works top-down.
  rows.sort((a, b) => b.daysOverdue - a.daysOverdue);

  const byPartyMap = new Map<string, AgingPartyRollup>();
  let totalOpenCents = 0;
  const bucketTotals: Record<AgingBucket, number> = {
    '0-30': 0,
    '31-60': 0,
    '61-90': 0,
    '90+': 0,
  };

  for (const r of rows) {
    totalOpenCents += r.openCents;
    bucketTotals[r.bucket] += r.openCents;

    const existing =
      byPartyMap.get(r.partyName) ??
      ({
        partyName: r.partyName,
        invoiceCount: 0,
        totalOpenCents: 0,
        bucket0to30Cents: 0,
        bucket31to60Cents: 0,
        bucket61to90Cents: 0,
        bucket90PlusCents: 0,
        oldestDaysOverdue: 0,
      } as AgingPartyRollup);

    existing.invoiceCount += 1;
    existing.totalOpenCents += r.openCents;
    if (r.bucket === '0-30') existing.bucket0to30Cents += r.openCents;
    else if (r.bucket === '31-60') existing.bucket31to60Cents += r.openCents;
    else if (r.bucket === '61-90') existing.bucket61to90Cents += r.openCents;
    else existing.bucket90PlusCents += r.openCents;
    if (r.daysOverdue > existing.oldestDaysOverdue) {
      existing.oldestDaysOverdue = r.daysOverdue;
    }

    byPartyMap.set(r.partyName, existing);
  }

  // Worst offenders first — most dangerous money on top.
  const byParty = Array.from(byPartyMap.values()).sort((a, b) => {
    if (b.bucket90PlusCents !== a.bucket90PlusCents) {
      return b.bucket90PlusCents - a.bucket90PlusCents;
    }
    return b.totalOpenCents - a.totalOpenCents;
  });

  return {
    asOf,
    rows,
    byParty,
    totalOpenCents,
    bucketTotals,
    hasDangerBucket: bucketTotals['90+'] > 0,
  };
}

/** Determine the effective due date — use the invoice's stated dueDate
 *  if set, otherwise synthesize it as invoiceDate + 30 (Net-30 fallback). */
function effectiveDueDate(
  stated: string | undefined,
  invoiceDate: string,
): { dueDate: string; synthesized: boolean } {
  if (stated) return { dueDate: stated, synthesized: false };
  return { dueDate: addDays(invoiceDate, 30), synthesized: true };
}

/** Number of whole calendar days between two yyyy-mm-dd strings.
 *  Returns 0 if `to` < `from` (i.e. not yet due). Both dates are
 *  treated as UTC midnight to avoid DST drift. */
function daysBetween(from: string, to: string): number {
  const f = Date.parse(`${from}T00:00:00Z`);
  const t = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(f) || Number.isNaN(t)) return 0;
  if (t <= f) return 0;
  return Math.floor((t - f) / (1000 * 60 * 60 * 24));
}

/** Add `n` calendar days to a yyyy-mm-dd. Pure, UTC. */
function addDays(date: string, n: number): string {
  const t = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(t)) return date;
  const dt = new Date(t + n * 1000 * 60 * 60 * 24);
  return dt.toISOString().slice(0, 10);
}

/** Map daysOverdue → bucket label. */
function bucketFor(daysOverdue: number): AgingBucket {
  if (daysOverdue <= 30) return '0-30';
  if (daysOverdue <= 60) return '31-60';
  if (daysOverdue <= 90) return '61-90';
  return '90+';
}
