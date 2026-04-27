// AR collections priority queue.
//
// Plain English: who should the bookkeeper call this morning? Combines
// oldest-days-overdue, total open balance, and revenue concentration
// into a single 0-100 priority score per customer. Rank desc; the
// top of the list is the call queue.
//
// Pure derivation. Composes data already in AR invoices.

import type { ArInvoice } from './ar-invoice';

export interface CollectionPriorityRow {
  customerName: string;
  openBalanceCents: number;
  /** Oldest invoice days-overdue across this customer's open invoices.
   *  Net-30 fallback when invoice has no dueDate. */
  oldestDaysOverdue: number;
  invoiceCount: number;
  /** Customer's open balance / total open balance. 0..1. */
  shareOfOutstanding: number;
  /** Composite 0-100 score:
   *    50% oldest-days-overdue (capped at 90 days = 50 points)
   *    35% open-balance share (this customer / portfolio)
   *    15% absolute balance (capped at $100k = 15 points)
   *  Score 100 = oldest payer with biggest balance and biggest share. */
  priorityScore: number;
}

export interface CollectionPriorityReport {
  asOf: string;
  totalOutstandingCents: number;
  rows: CollectionPriorityRow[];
}

export interface CollectionPriorityInputs {
  /** ISO yyyy-mm-dd; defaults to today (UTC). */
  asOf?: string;
  arInvoices: ArInvoice[];
}

export function buildCollectionPriority(
  inputs: CollectionPriorityInputs,
): CollectionPriorityReport {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);

  type Bucket = {
    customerName: string;
    open: number;
    invoiceCount: number;
    oldestOverdue: number;
  };
  const byCustomer = new Map<string, Bucket>();
  let totalOutstanding = 0;

  for (const inv of inputs.arInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'WRITTEN_OFF' || inv.status === 'PAID') continue;
    const open = Math.max(0, inv.totalCents - inv.paidCents);
    if (open === 0) continue;
    const due = inv.dueDate ?? addDays(inv.invoiceDate, 30);
    const overdue = Math.max(0, daysBetween(due, asOf));
    const key = inv.customerName.trim().toLowerCase();
    const b =
      byCustomer.get(key) ??
      ({
        customerName: inv.customerName.trim(),
        open: 0,
        invoiceCount: 0,
        oldestOverdue: 0,
      } as Bucket);
    b.open += open;
    b.invoiceCount += 1;
    if (overdue > b.oldestOverdue) b.oldestOverdue = overdue;
    byCustomer.set(key, b);
    totalOutstanding += open;
  }

  const rows: CollectionPriorityRow[] = [];
  for (const [, b] of byCustomer) {
    const share = totalOutstanding === 0 ? 0 : b.open / totalOutstanding;
    const ageScore = Math.min(50, (b.oldestOverdue / 90) * 50);
    const shareScore = Math.min(35, share * 100); // share=1 → 35
    const balScore = Math.min(15, (b.open / (100_000_00)) * 15);
    const score = Math.round(ageScore + shareScore + balScore);
    rows.push({
      customerName: b.customerName,
      openBalanceCents: b.open,
      oldestDaysOverdue: b.oldestOverdue,
      invoiceCount: b.invoiceCount,
      shareOfOutstanding: round4(share),
      priorityScore: score,
    });
  }
  rows.sort((a, b) => b.priorityScore - a.priorityScore);

  return {
    asOf,
    totalOutstandingCents: totalOutstanding,
    rows,
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

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
