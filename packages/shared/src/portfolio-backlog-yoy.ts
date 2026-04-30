// Portfolio awarded-job backlog year-over-year.
//
// Plain English: take a year-end (Dec 31) snapshot of awarded
// jobs and compute backlog (engineer's-estimate value minus
// AR billed-to-date). YoY tracks whether the work-on-the-books
// pipeline grew or shrank year over year. Sized for the
// lender's year-end review.
//
// Different from portfolio-backlog-monthly (per month).
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';
import type { Job } from './job';

export interface PortfolioBacklogYoyBucket {
  awardedJobs: number;
  contractValueCents: number;
  billedToDateCents: number;
  backlogCents: number;
}

export interface PortfolioBacklogYoyResult {
  priorYear: number;
  currentYear: number;
  prior: PortfolioBacklogYoyBucket;
  current: PortfolioBacklogYoyBucket;
  backlogCentsDelta: number;
}

export interface PortfolioBacklogYoyInputs {
  jobs: Job[];
  arInvoices: ArInvoice[];
  currentYear: number;
}

function snapshot(
  jobs: Job[],
  invoices: ArInvoice[],
  asOf: string,
): PortfolioBacklogYoyBucket {
  let awardedJobs = 0;
  let contractValueCents = 0;
  let billedToDateCents = 0;

  const awardedIds = new Set<string>();
  for (const j of jobs) {
    const status = j.status ?? 'PURSUING';
    if (status !== 'AWARDED') continue;
    if (j.createdAt > `${asOf}T23:59:59.999Z`) continue;
    awardedIds.add(j.id);
    awardedJobs += 1;
    contractValueCents += j.engineersEstimateCents ?? 0;
  }

  for (const inv of invoices) {
    if (!awardedIds.has(inv.jobId)) continue;
    if (inv.invoiceDate > asOf) continue;
    billedToDateCents += inv.totalCents ?? 0;
  }

  return {
    awardedJobs,
    contractValueCents,
    billedToDateCents,
    backlogCents: Math.max(0, contractValueCents - billedToDateCents),
  };
}

export function buildPortfolioBacklogYoy(
  inputs: PortfolioBacklogYoyInputs,
): PortfolioBacklogYoyResult {
  const priorYear = inputs.currentYear - 1;
  const prior = snapshot(inputs.jobs, inputs.arInvoices, `${priorYear}-12-31`);
  const current = snapshot(inputs.jobs, inputs.arInvoices, `${inputs.currentYear}-12-31`);
  return {
    priorYear,
    currentYear: inputs.currentYear,
    prior,
    current,
    backlogCentsDelta: current.backlogCents - prior.backlogCents,
  };
}
