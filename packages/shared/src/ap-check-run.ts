// AP check-run candidate list.
//
// Plain English: every Friday Brook does an AP run. The pile to
// look at is "every APPROVED invoice that still has an unpaid
// balance, sorted by how urgent the payment is." This module
// builds that pile for a given asOf date, classifies each line
// by due-date urgency, and rolls up:
//   - per-vendor totals (so we cut one check per vendor, not one
//     per invoice)
//   - cash needed by tier (so the morning briefing can say "you
//     need $X to clear the OVERDUE bucket alone")
//
// Pure derivation. No persisted records. Uses the existing
// apDueLevel helper from ap-invoice for consistency.

import { apDueLevel, unpaidBalanceCents, type ApInvoice } from './ap-invoice';
import type { Vendor } from './vendor';

export type CheckRunUrgency =
  | 'OVERDUE'   // dueDate has passed
  | 'DUE_SOON'  // due within 7 days
  | 'DUE_LATER' // due >7 days out OR no due date and not flagged
  | 'NO_DATE';  // no due date set at all

export interface CheckRunRow {
  invoiceId: string;
  vendorName: string;
  vendorId: string | null;
  invoiceNumber: string | null;
  invoiceDate: string;
  dueDate: string | null;
  daysToDue: number | null;
  unpaidCents: number;
  urgency: CheckRunUrgency;
  /** True iff the matched vendor record is on hold. */
  vendorOnHold: boolean;
}

export interface CheckRunVendorRollup {
  vendorName: string;
  vendorId: string | null;
  invoiceCount: number;
  unpaidTotalCents: number;
  /** True if any of this vendor's invoices are OVERDUE. */
  hasOverdue: boolean;
  vendorOnHold: boolean;
}

export interface CheckRunRollup {
  totalInvoices: number;
  totalUnpaidCents: number;
  overdueCount: number;
  overdueCents: number;
  dueSoonCount: number;
  dueSoonCents: number;
  /** Total to clear OVERDUE only — minimum cash needed this run. */
  minCashNeededCents: number;
  /** Total to clear OVERDUE + DUE_SOON — recommended target. */
  recommendedCashCents: number;
  vendorsOnHoldCount: number;
}

export interface CheckRunInputs {
  /** ISO yyyy-mm-dd; defaults to today. */
  asOf?: string;
  apInvoices: ApInvoice[];
  vendors?: Vendor[];
}

export function buildApCheckRun(inputs: CheckRunInputs): {
  rollup: CheckRunRollup;
  rows: CheckRunRow[];
  byVendor: CheckRunVendorRollup[];
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const refNow = new Date(`${asOf}T00:00:00Z`);

  // Vendor lookup so on-hold flags + vendorId can attach.
  const byName = new Map<string, Vendor>();
  for (const v of inputs.vendors ?? []) {
    byName.set(normalize(v.legalName), v);
    if (v.dbaName) byName.set(normalize(v.dbaName), v);
  }

  const rows: CheckRunRow[] = [];
  const vendorBuckets = new Map<string, CheckRunVendorRollup>();
  const rollup: CheckRunRollup = {
    totalInvoices: 0,
    totalUnpaidCents: 0,
    overdueCount: 0,
    overdueCents: 0,
    dueSoonCount: 0,
    dueSoonCents: 0,
    minCashNeededCents: 0,
    recommendedCashCents: 0,
    vendorsOnHoldCount: 0,
  };

  for (const inv of inputs.apInvoices) {
    if (inv.status !== 'APPROVED') continue;
    const unpaid = unpaidBalanceCents(inv);
    if (unpaid <= 0) continue;

    const matched = byName.get(normalize(inv.vendorName));
    const vendorId = matched?.id ?? null;
    const onHold = matched?.onHold === true;

    let urgency: CheckRunUrgency;
    let daysToDue: number | null = null;
    if (!inv.dueDate) {
      urgency = 'NO_DATE';
    } else {
      const dueDate = parseDate(inv.dueDate);
      if (!dueDate) {
        urgency = 'NO_DATE';
      } else {
        daysToDue = daysBetween(refNow, dueDate);
        const lvl = apDueLevel(inv, refNow);
        if (lvl === 'overdue') urgency = 'OVERDUE';
        else if (lvl === 'dueSoon') urgency = 'DUE_SOON';
        else urgency = 'DUE_LATER';
      }
    }

    rows.push({
      invoiceId: inv.id,
      vendorName: inv.vendorName,
      vendorId,
      invoiceNumber: inv.invoiceNumber ?? null,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate ?? null,
      daysToDue,
      unpaidCents: unpaid,
      urgency,
      vendorOnHold: onHold,
    });

    rollup.totalInvoices += 1;
    rollup.totalUnpaidCents += unpaid;
    if (urgency === 'OVERDUE') {
      rollup.overdueCount += 1;
      rollup.overdueCents += unpaid;
    } else if (urgency === 'DUE_SOON') {
      rollup.dueSoonCount += 1;
      rollup.dueSoonCents += unpaid;
    }

    const key = normalize(inv.vendorName);
    const b = vendorBuckets.get(key) ?? {
      vendorName: matched?.dbaName ?? matched?.legalName ?? inv.vendorName.trim(),
      vendorId,
      invoiceCount: 0,
      unpaidTotalCents: 0,
      hasOverdue: false,
      vendorOnHold: onHold,
    };
    b.invoiceCount += 1;
    b.unpaidTotalCents += unpaid;
    if (urgency === 'OVERDUE') b.hasOverdue = true;
    if (onHold) b.vendorOnHold = true;
    vendorBuckets.set(key, b);
  }

  rollup.minCashNeededCents = rollup.overdueCents;
  rollup.recommendedCashCents = rollup.overdueCents + rollup.dueSoonCents;
  rollup.vendorsOnHoldCount = Array.from(vendorBuckets.values()).filter(
    (v) => v.vendorOnHold,
  ).length;

  // Worst (OVERDUE) first; daysToDue asc within tier.
  const tierRank: Record<CheckRunUrgency, number> = {
    OVERDUE: 0,
    DUE_SOON: 1,
    DUE_LATER: 2,
    NO_DATE: 3,
  };
  rows.sort((a, b) => {
    if (a.urgency !== b.urgency) return tierRank[a.urgency] - tierRank[b.urgency];
    if (a.daysToDue === null) return 1;
    if (b.daysToDue === null) return -1;
    return a.daysToDue - b.daysToDue;
  });

  const byVendor = Array.from(vendorBuckets.values()).sort((a, b) => {
    if (a.hasOverdue !== b.hasOverdue) return a.hasOverdue ? -1 : 1;
    return b.unpaidTotalCents - a.unpaidTotalCents;
  });

  return { rollup, rows, byVendor };
}

function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,'"`]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(llc|inc|incorporated|corp|corporation|co|company|ltd|limited)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
