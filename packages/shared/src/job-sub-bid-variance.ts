// Per-job sub-bid vs actual variance.
//
// Plain English: when YGE lists a sub on the §4104 sub-list at
// bid time, the agency expects that sub to perform that scope at
// roughly that price. If we end up using a different sub or
// paying significantly more, two things happen:
//   - The §4104 list may need an amendment (PCC §4107 substitution
//     hearing if the listed sub is being replaced)
//   - The cost variance shows up against the bid estimate
//
// This module joins the priced-estimate sub-bid list against
// actual AP spend to subs on the same job, contractor by
// contractor:
//   - listed sub with actual spend (matched)
//   - listed sub with NO spend (sub never engaged — substitution?)
//   - unlisted sub with spend (sub appeared without §4104 listing
//     — late-add or an emergency that needs a §4107 paper trail)
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Job } from './job';
import type { SubBid } from './sub-bid';
import type { Vendor } from './vendor';

export type SubVarianceRowKind = 'MATCHED' | 'LISTED_NO_SPEND' | 'UNLISTED_WITH_SPEND';

export interface SubVarianceRow {
  jobId: string;
  contractorName: string;
  kind: SubVarianceRowKind;
  /** Bid amount on the §4104 list. Null when UNLISTED_WITH_SPEND. */
  bidAmountCents: number | null;
  /** Actual AP spend to this sub on this job. */
  actualSpendCents: number;
  /** actual - bid. Null when no bid to compare. */
  varianceCents: number | null;
  /** variance / bid. Null when no bid. */
  variancePct: number | null;
}

export interface JobSubVarianceJobRow {
  jobId: string;
  projectName: string;
  listedCount: number;
  matchedCount: number;
  listedNoSpendCount: number;
  unlistedWithSpendCount: number;
  totalListedBidCents: number;
  totalActualSpendCents: number;
  /** actual - listed (positive = ran over the listed total). */
  totalVarianceCents: number;
  rows: SubVarianceRow[];
}

export interface JobSubVarianceRollup {
  jobsConsidered: number;
  totalUnlistedWithSpend: number;
  totalListedNoSpend: number;
}

export interface JobSubVarianceInputs {
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  /** Map<jobId, priced estimate sub bids>. Caller pulls the most
   *  recent priced estimate's subBids for each job. */
  subBidsByJobId: Map<string, SubBid[]>;
  vendors: Vendor[];
  apInvoices: ApInvoice[];
  /** When false (default), only AWARDED jobs are scored. */
  includeAllStatuses?: boolean;
}

export function buildJobSubBidVariance(
  inputs: JobSubVarianceInputs,
): {
  rollup: JobSubVarianceRollup;
  jobs: JobSubVarianceJobRow[];
} {
  const includeAll = inputs.includeAllStatuses === true;

  // Vendor name lookup so AP names → vendor master rows.
  const subVendors = inputs.vendors.filter((v) => v.kind === 'SUBCONTRACTOR');
  const byName = new Map<string, Vendor>();
  for (const v of subVendors) {
    byName.set(normalize(v.legalName), v);
    if (v.dbaName) byName.set(normalize(v.dbaName), v);
  }

  // AP spend per (jobId, vendor canonical key). We key by vendor.id
  // when we can resolve the AP invoice to a master record — that
  // way a sub listed by DBA name and an invoice paid to legal name
  // collide on the same key. Fallback `name:<normalized>` for
  // invoices we can't resolve.
  const apSpend = new Map<string, Map<string, number>>();
  /** displayName lookup for fallback keys. */
  const fallbackDisplay = new Map<string, string>();
  for (const inv of inputs.apInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'REJECTED') continue;
    if (!inv.jobId) continue;
    const v = byName.get(normalize(inv.vendorName));
    if (!v) continue; // not a tracked sub
    const key = `vid:${v.id}`;
    const jobMap = apSpend.get(inv.jobId) ?? new Map<string, number>();
    jobMap.set(key, (jobMap.get(key) ?? 0) + inv.totalCents);
    apSpend.set(inv.jobId, jobMap);
    if (!fallbackDisplay.has(key)) {
      fallbackDisplay.set(key, v.dbaName ?? v.legalName);
    }
  }

  const jobs: JobSubVarianceJobRow[] = [];
  let totalUnlisted = 0;
  let totalListedNoSpend = 0;

  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;

    const listedSubs = inputs.subBidsByJobId.get(j.id) ?? [];
    const apForJob = apSpend.get(j.id) ?? new Map<string, number>();
    const seenKeys = new Set<string>();
    const rows: SubVarianceRow[] = [];
    let totalListed = 0;
    let totalActual = 0;
    let listedNoSpend = 0;
    let matched = 0;

    for (const s of listedSubs) {
      // Resolve listed contractor to vendor master so the apSpend
      // lookup uses the same canonical key. If no master row,
      // fall back to a name-based key (won't match AP either way
      // since AP requires a master row to be tracked).
      const v = byName.get(normalize(s.contractorName));
      const key = v ? `vid:${v.id}` : `name:${normalize(s.contractorName)}`;
      seenKeys.add(key);
      const actual = apForJob.get(key) ?? 0;
      totalListed += s.bidAmountCents;
      totalActual += actual;
      if (actual === 0) {
        listedNoSpend += 1;
        rows.push({
          jobId: j.id,
          contractorName: s.contractorName,
          kind: 'LISTED_NO_SPEND',
          bidAmountCents: s.bidAmountCents,
          actualSpendCents: 0,
          varianceCents: null,
          variancePct: null,
        });
      } else {
        matched += 1;
        const variance = actual - s.bidAmountCents;
        const pct =
          s.bidAmountCents === 0
            ? null
            : round4(variance / s.bidAmountCents);
        rows.push({
          jobId: j.id,
          contractorName: s.contractorName,
          kind: 'MATCHED',
          bidAmountCents: s.bidAmountCents,
          actualSpendCents: actual,
          varianceCents: variance,
          variancePct: pct,
        });
      }
    }

    // Unlisted-with-spend: vid keys that weren't matched by any
    // listed sub.
    let unlistedWithSpend = 0;
    for (const [key, actual] of apForJob.entries()) {
      if (seenKeys.has(key)) continue;
      unlistedWithSpend += 1;
      const display = fallbackDisplay.get(key) ?? key;
      rows.push({
        jobId: j.id,
        contractorName: display,
        kind: 'UNLISTED_WITH_SPEND',
        bidAmountCents: null,
        actualSpendCents: actual,
        varianceCents: null,
        variancePct: null,
      });
      totalActual += actual;
    }

    // Sort rows: UNLISTED_WITH_SPEND first (most actionable —
    // §4107 substitution risk), then LISTED_NO_SPEND, then
    // MATCHED rows by |variance| desc.
    const tier: Record<SubVarianceRowKind, number> = {
      UNLISTED_WITH_SPEND: 0,
      LISTED_NO_SPEND: 1,
      MATCHED: 2,
    };
    rows.sort((a, b) => {
      if (a.kind !== b.kind) return tier[a.kind] - tier[b.kind];
      return Math.abs(b.varianceCents ?? 0) - Math.abs(a.varianceCents ?? 0);
    });

    jobs.push({
      jobId: j.id,
      projectName: j.projectName,
      listedCount: listedSubs.length,
      matchedCount: matched,
      listedNoSpendCount: listedNoSpend,
      unlistedWithSpendCount: unlistedWithSpend,
      totalListedBidCents: totalListed,
      totalActualSpendCents: totalActual,
      totalVarianceCents: totalActual - totalListed,
      rows,
    });
    totalUnlisted += unlistedWithSpend;
    totalListedNoSpend += listedNoSpend;
  }

  // Highest absolute total-variance first.
  jobs.sort(
    (a, b) =>
      Math.abs(b.totalVarianceCents) - Math.abs(a.totalVarianceCents),
  );

  return {
    rollup: {
      jobsConsidered: jobs.length,
      totalUnlistedWithSpend: totalUnlisted,
      totalListedNoSpend,
    },
    jobs,
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
