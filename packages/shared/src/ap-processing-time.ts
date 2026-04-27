// AP invoice processing time.
//
// Plain English: invoice arrives at YGE, gets entered into the
// system, gets routed for approval, gets approved, eventually gets
// paid. Each leg of that journey takes time, and slow legs are
// where invoices age (vendor relationships erode + late fees pile
// up).
//
// This walks AP invoices and reports the bottleneck timing per
// stage, both globally and per-vendor:
//   - invoiceDate → createdAt   (data-entry lag)
//   - createdAt → approvedAt    (approval lag)
//
// Drives "where is AP getting stuck?" view.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';

export interface ProcessingTimeStageStats {
  /** Number of invoices that have hit this stage. */
  count: number;
  /** Avg days through this stage (rounded to 0.1). */
  avgDays: number;
  /** Slowest single invoice's days through this stage. */
  worstDays: number;
}

export interface ProcessingTimeRow {
  vendorName: string;
  invoicesConsidered: number;
  pendingCount: number;
  approvedCount: number;
  paidCount: number;
  /** Average days from invoiceDate to createdAt. */
  avgEntryLagDays: number;
  /** Average days from createdAt to approvedAt. */
  avgApprovalLagDays: number;
  /** Combined: invoiceDate → approvedAt. */
  avgTotalToApprovedDays: number;
}

export interface ProcessingTimeRollup {
  invoicesConsidered: number;
  /** Stage stats across the input set. */
  entryLag: ProcessingTimeStageStats;
  approvalLag: ProcessingTimeStageStats;
  totalToApproved: ProcessingTimeStageStats;
  /** Vendors with avgTotalToApproved > 7 days — bottleneck vendors. */
  bottleneckVendorCount: number;
}

export interface ProcessingTimeInputs {
  apInvoices: ApInvoice[];
  /** Optional yyyy-mm-dd window applied against invoiceDate. */
  fromDate?: string;
  toDate?: string;
}

export function buildApProcessingTime(
  inputs: ProcessingTimeInputs,
): {
  rollup: ProcessingTimeRollup;
  rows: ProcessingTimeRow[];
} {
  const inRange = (d: string) => {
    if (inputs.fromDate && d < inputs.fromDate) return false;
    if (inputs.toDate && d > inputs.toDate) return false;
    return true;
  };

  type Bucket = {
    vendorName: string;
    invoicesConsidered: number;
    pendingCount: number;
    approvedCount: number;
    paidCount: number;
    entrySum: number;
    entryCount: number;
    approvalSum: number;
    approvalCount: number;
    totalSum: number;
    totalCount: number;
  };
  const buckets = new Map<string, Bucket>();

  // Global stage stats.
  const entry = { count: 0, sum: 0, worst: 0 };
  const approval = { count: 0, sum: 0, worst: 0 };
  const total = { count: 0, sum: 0, worst: 0 };

  for (const inv of inputs.apInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'REJECTED') continue;
    if (!inRange(inv.invoiceDate)) continue;

    const invDate = parseDate(inv.invoiceDate);
    const createdDate = parseIsoDate(inv.createdAt);
    if (!invDate || !createdDate) continue;

    const key = inv.vendorName.trim().toLowerCase();
    const b = buckets.get(key) ?? {
      vendorName: inv.vendorName.trim(),
      invoicesConsidered: 0,
      pendingCount: 0,
      approvedCount: 0,
      paidCount: 0,
      entrySum: 0,
      entryCount: 0,
      approvalSum: 0,
      approvalCount: 0,
      totalSum: 0,
      totalCount: 0,
    };
    b.invoicesConsidered += 1;
    if (inv.status === 'PENDING') b.pendingCount += 1;
    if (inv.status === 'APPROVED') b.approvedCount += 1;
    if (inv.status === 'PAID') b.paidCount += 1;

    const entryDays = Math.max(0, daysBetween(invDate, createdDate));
    b.entrySum += entryDays;
    b.entryCount += 1;
    entry.count += 1;
    entry.sum += entryDays;
    if (entryDays > entry.worst) entry.worst = entryDays;

    if (inv.approvedAt) {
      const approvedDate = parseIsoDate(inv.approvedAt);
      if (approvedDate) {
        const approvalDays = Math.max(0, daysBetween(createdDate, approvedDate));
        b.approvalSum += approvalDays;
        b.approvalCount += 1;
        approval.count += 1;
        approval.sum += approvalDays;
        if (approvalDays > approval.worst) approval.worst = approvalDays;

        const totalDays = Math.max(0, daysBetween(invDate, approvedDate));
        b.totalSum += totalDays;
        b.totalCount += 1;
        total.count += 1;
        total.sum += totalDays;
        if (totalDays > total.worst) total.worst = totalDays;
      }
    }

    buckets.set(key, b);
  }

  const rows: ProcessingTimeRow[] = [];
  let bottleneckVendors = 0;
  for (const b of buckets.values()) {
    const avgEntry = b.entryCount === 0 ? 0 : b.entrySum / b.entryCount;
    const avgApproval = b.approvalCount === 0 ? 0 : b.approvalSum / b.approvalCount;
    const avgTotal = b.totalCount === 0 ? 0 : b.totalSum / b.totalCount;
    rows.push({
      vendorName: b.vendorName,
      invoicesConsidered: b.invoicesConsidered,
      pendingCount: b.pendingCount,
      approvedCount: b.approvedCount,
      paidCount: b.paidCount,
      avgEntryLagDays: round1(avgEntry),
      avgApprovalLagDays: round1(avgApproval),
      avgTotalToApprovedDays: round1(avgTotal),
    });
    if (avgTotal > 7) bottleneckVendors += 1;
  }

  // Slowest end-to-end first.
  rows.sort((a, b) => b.avgTotalToApprovedDays - a.avgTotalToApprovedDays);

  return {
    rollup: {
      invoicesConsidered: entry.count,
      entryLag: stageStats(entry),
      approvalLag: stageStats(approval),
      totalToApproved: stageStats(total),
      bottleneckVendorCount: bottleneckVendors,
    },
    rows,
  };
}

function stageStats(s: { count: number; sum: number; worst: number }): ProcessingTimeStageStats {
  return {
    count: s.count,
    avgDays: s.count === 0 ? 0 : round1(s.sum / s.count),
    worstDays: s.worst,
  };
}

function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseIsoDate(s: string): Date | null {
  const head = s.slice(0, 10);
  return parseDate(head);
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
