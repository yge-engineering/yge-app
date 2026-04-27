// Vendor × Job spend cross-tabulation.
//
// Plain English: vendor-concentration tells us how much we spend
// with each vendor across the whole company; job-sub-spend tells
// us who got paid on each job. This module weaves them together —
// for each vendor, show the list of jobs we used them on AND the
// amount per job. That surfaces:
//   - "Acme Trucking is on 8 of our 12 active jobs" (single point
//     of failure)
//   - "We use Bob's Concrete heavily on Sulphur Springs but
//     nowhere else" (job-specific dependency)
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Vendor } from './vendor';

export interface VendorJobCell {
  jobId: string;
  totalCents: number;
  paidCents: number;
  invoiceCount: number;
}

export interface VendorJobCrosstabRow {
  vendorId: string | null;
  vendorName: string;
  jobCount: number;
  totalSpendCents: number;
  /** Cells, sorted by amount desc. */
  jobs: VendorJobCell[];
  /** True iff this vendor appears on >=3 jobs. */
  multiJobVendor: boolean;
  /** Top job's share of this vendor's spend. */
  topJobSharePct: number;
}

export interface VendorJobCrosstabRollup {
  vendorsConsidered: number;
  jobsConsidered: number;
  /** Vendors on >=3 jobs (cross-cutting concentration risk). */
  multiJobVendors: number;
}

export interface VendorJobCrosstabInputs {
  /** Optional yyyy-mm-dd window. */
  fromDate?: string;
  toDate?: string;
  vendors: Vendor[];
  apInvoices: ApInvoice[];
  /** Min job count for a vendor to surface. Default 1. */
  minJobs?: number;
}

export function buildVendorJobCrosstab(
  inputs: VendorJobCrosstabInputs,
): {
  rollup: VendorJobCrosstabRollup;
  rows: VendorJobCrosstabRow[];
} {
  const minJobs = inputs.minJobs ?? 1;
  const inRange = (d: string) => {
    if (inputs.fromDate && d < inputs.fromDate) return false;
    if (inputs.toDate && d > inputs.toDate) return false;
    return true;
  };

  const byName = new Map<string, Vendor>();
  for (const v of inputs.vendors) {
    byName.set(normalize(v.legalName), v);
    if (v.dbaName) byName.set(normalize(v.dbaName), v);
  }

  type Bucket = {
    vendorId: string | null;
    vendorName: string;
    perJob: Map<string, VendorJobCell>;
  };
  const buckets = new Map<string, Bucket>();
  const allJobs = new Set<string>();

  for (const inv of inputs.apInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'REJECTED') continue;
    if (!inv.jobId) continue;
    if (!inRange(inv.invoiceDate)) continue;

    const matched = byName.get(normalize(inv.vendorName));
    const key = matched?.id ?? `name:${normalize(inv.vendorName)}`;
    const b = buckets.get(key) ?? {
      vendorId: matched?.id ?? null,
      vendorName: matched?.dbaName ?? matched?.legalName ?? inv.vendorName.trim(),
      perJob: new Map<string, VendorJobCell>(),
    };
    const cell = b.perJob.get(inv.jobId) ?? {
      jobId: inv.jobId,
      totalCents: 0,
      paidCents: 0,
      invoiceCount: 0,
    };
    cell.totalCents += inv.totalCents;
    cell.paidCents += inv.paidCents;
    cell.invoiceCount += 1;
    b.perJob.set(inv.jobId, cell);
    buckets.set(key, b);
    allJobs.add(inv.jobId);
  }

  const rows: VendorJobCrosstabRow[] = [];
  let multiJobCount = 0;
  for (const b of buckets.values()) {
    const cells = Array.from(b.perJob.values()).sort(
      (a, b) => b.totalCents - a.totalCents,
    );
    if (cells.length < minJobs) continue;

    let total = 0;
    for (const c of cells) total += c.totalCents;
    const topShare = total === 0 || cells[0] === undefined
      ? 0
      : cells[0].totalCents / total;

    const multiJob = cells.length >= 3;
    if (multiJob) multiJobCount += 1;

    rows.push({
      vendorId: b.vendorId,
      vendorName: b.vendorName,
      jobCount: cells.length,
      totalSpendCents: total,
      jobs: cells,
      multiJobVendor: multiJob,
      topJobSharePct: round4(topShare),
    });
  }

  // Highest total spend first.
  rows.sort((a, b) => b.totalSpendCents - a.totalSpendCents);

  return {
    rollup: {
      vendorsConsidered: rows.length,
      jobsConsidered: allJobs.size,
      multiJobVendors: multiJobCount,
    },
    rows,
  };
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

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
