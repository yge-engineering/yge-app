// Portfolio backlog snapshot (point-in-time).
//
// Plain English: as-of date, sum awarded jobs' contract value
// (engineer's-estimate proxy) minus AR billed-to-date. The
// remaining "backlog" is what YGE still has to bill out.
// Drives the right-now work-on-the-books overview.
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';
import type { Job } from './job';

export interface PortfolioBacklogSnapshotResult {
  asOf: string;
  awardedJobs: number;
  contractValueCents: number;
  billedToDateCents: number;
  backlogCents: number;
}

export interface PortfolioBacklogSnapshotInputs {
  jobs: Job[];
  arInvoices: ArInvoice[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function buildPortfolioBacklogSnapshot(
  inputs: PortfolioBacklogSnapshotInputs,
): PortfolioBacklogSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  let awardedJobs = 0;
  let contractValueCents = 0;
  let billedToDateCents = 0;
  const awardedIds = new Set<string>();

  for (const j of inputs.jobs) {
    const status = j.status ?? 'PURSUING';
    if (status !== 'AWARDED') continue;
    if (j.createdAt > `${asOf}T23:59:59.999Z`) continue;
    awardedIds.add(j.id);
    awardedJobs += 1;
    contractValueCents += j.engineersEstimateCents ?? 0;
  }

  for (const inv of inputs.arInvoices) {
    if (!awardedIds.has(inv.jobId)) continue;
    if (inv.invoiceDate > asOf) continue;
    billedToDateCents += inv.totalCents ?? 0;
  }

  return {
    asOf,
    awardedJobs,
    contractValueCents,
    billedToDateCents,
    backlogCents: Math.max(0, contractValueCents - billedToDateCents),
  };
}
