// Per-job subcontractor spend.
//
// Plain English: drilling INTO a single job to see which subs got
// paid and how much. Distinct from sub-scorecard which is sub-
// centric (one row per sub across all jobs). Useful for:
//   - close-out: "did we pay every sub we listed on the §4104?"
//   - billing reviews: "where is the labor share vs sub share on
//     this job?"
//   - sub bid leveling for the next similar job
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Job } from './job';
import type { Vendor } from './vendor';

export interface JobSubSpendBreakdown {
  vendorId: string | null;
  vendorName: string;
  invoiceCount: number;
  totalCents: number;
  paidCents: number;
  /** True iff vendor master has SUBCONTRACTOR kind. False when the
   *  AP invoice vendorName didn't resolve or the matched vendor is
   *  a SUPPLIER/etc — surfaces "we're miscategorizing this AP
   *  line" data-quality flags. */
  isSubcontractor: boolean;
}

export interface JobSubSpendRow {
  jobId: string;
  projectName: string;
  totalSubSpendCents: number;
  /** Sub spend that resolved to a SUBCONTRACTOR vendor record. */
  attributedSubSpendCents: number;
  subCount: number;
  topSub: JobSubSpendBreakdown | null;
  topSubSharePct: number;
  subs: JobSubSpendBreakdown[];
}

export interface JobSubSpendRollup {
  jobsConsidered: number;
  totalSubSpendCents: number;
  totalAttributedSubSpendCents: number;
}

export interface JobSubSpendInputs {
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  vendors: Vendor[];
  apInvoices: ApInvoice[];
  /** When false (default), only AWARDED jobs counted. */
  includeAllStatuses?: boolean;
  /** When true (default), only AP invoices that resolve to a
   *  SUBCONTRACTOR vendor count toward sub spend. When false,
   *  every AP invoice is treated as sub spend (caller filtered). */
  onlySubcontractorVendors?: boolean;
}

export function buildJobSubSpend(inputs: JobSubSpendInputs): {
  rollup: JobSubSpendRollup;
  rows: JobSubSpendRow[];
} {
  const includeAll = inputs.includeAllStatuses === true;
  const onlySubs = inputs.onlySubcontractorVendors !== false;

  const byName = new Map<string, Vendor>();
  for (const v of inputs.vendors) {
    byName.set(normalize(v.legalName), v);
    if (v.dbaName) byName.set(normalize(v.dbaName), v);
  }

  type Bucket = {
    jobId: string;
    perVendor: Map<string, JobSubSpendBreakdown>;
  };
  const jobBuckets = new Map<string, Bucket>();

  for (const inv of inputs.apInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'REJECTED') continue;
    if (!inv.jobId) continue;

    const matched = byName.get(normalize(inv.vendorName));
    const isSubcontractor = matched?.kind === 'SUBCONTRACTOR';
    if (onlySubs && !isSubcontractor) continue;

    const b = jobBuckets.get(inv.jobId) ?? {
      jobId: inv.jobId,
      perVendor: new Map<string, JobSubSpendBreakdown>(),
    };
    const vKey = matched?.id ?? `name:${normalize(inv.vendorName)}`;
    const v = b.perVendor.get(vKey) ?? {
      vendorId: matched?.id ?? null,
      vendorName: matched?.dbaName ?? matched?.legalName ?? inv.vendorName.trim(),
      invoiceCount: 0,
      totalCents: 0,
      paidCents: 0,
      isSubcontractor,
    };
    v.invoiceCount += 1;
    v.totalCents += inv.totalCents;
    v.paidCents += inv.paidCents;
    b.perVendor.set(vKey, v);
    jobBuckets.set(inv.jobId, b);
  }

  const rows: JobSubSpendRow[] = [];
  let grandTotal = 0;
  let grandAttributed = 0;

  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const b = jobBuckets.get(j.id);
    const subs = b ? Array.from(b.perVendor.values()) : [];
    subs.sort((a, b) => b.totalCents - a.totalCents);

    let total = 0;
    let attributed = 0;
    for (const s of subs) {
      total += s.totalCents;
      if (s.isSubcontractor) attributed += s.totalCents;
    }

    const top = subs[0] ?? null;
    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      totalSubSpendCents: total,
      attributedSubSpendCents: attributed,
      subCount: subs.length,
      topSub: top,
      topSubSharePct: total === 0 || !top ? 0 : round4(top.totalCents / total),
      subs,
    });

    grandTotal += total;
    grandAttributed += attributed;
  }

  // Highest sub spend first.
  rows.sort((a, b) => b.totalSubSpendCents - a.totalSubSpendCents);

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalSubSpendCents: grandTotal,
      totalAttributedSubSpendCents: grandAttributed,
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
