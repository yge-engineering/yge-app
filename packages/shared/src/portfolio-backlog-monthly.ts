// Portfolio awarded-job backlog by month.
//
// Plain English: month-end snapshot of work-on-the-books minus
// work-billed-to-date. For every Job that's AWARDED on/before
// the month-end, sum the engineer's-estimate value (proxy for
// contract value) minus AR billed on/before that date. The
// remaining "backlog" is what YGE still has to bill out.
//
// Per row: month, awardedJobs, backlogCents, billedToDateCents,
// contractValueCents.
//
// Sort: month asc.
//
// Different from contract-value-waterfall (per job, no time
// axis), bid-pipeline (active list).
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';
import type { Job } from './job';

export interface PortfolioBacklogMonthlyRow {
  month: string;
  awardedJobs: number;
  contractValueCents: number;
  billedToDateCents: number;
  backlogCents: number;
}

export interface PortfolioBacklogMonthlyRollup {
  monthsConsidered: number;
}

export interface PortfolioBacklogMonthlyInputs {
  jobs: Job[];
  arInvoices: ArInvoice[];
  fromMonth: string;
  toMonth: string;
}

function lastDayOfMonth(yyyymm: string): string {
  const [yStr, mStr] = yyyymm.split('-');
  const y = Number(yStr ?? '0');
  const m = Number(mStr ?? '0');
  const d = new Date(Date.UTC(y, m, 0));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function nextYyyymm(yyyymm: string): string {
  const [yStr, mStr] = yyyymm.split('-');
  let y = Number(yStr ?? '0');
  let m = Number(mStr ?? '0');
  m += 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function buildPortfolioBacklogMonthly(
  inputs: PortfolioBacklogMonthlyInputs,
): {
  rollup: PortfolioBacklogMonthlyRollup;
  rows: PortfolioBacklogMonthlyRow[];
} {
  const rows: PortfolioBacklogMonthlyRow[] = [];
  let cur = inputs.fromMonth;
  while (cur <= inputs.toMonth) {
    const asOf = lastDayOfMonth(cur);
    let awardedJobs = 0;
    let contractValueCents = 0;
    let billedToDateCents = 0;

    const awardedIds = new Set<string>();
    for (const j of inputs.jobs) {
      const status = j.status ?? 'PURSUING';
      if (status !== 'AWARDED') continue;
      // Use createdAt as the "in the system as of" proxy. We don't
      // track an awardedOn date in Phase 1.
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

    rows.push({
      month: cur,
      awardedJobs,
      contractValueCents,
      billedToDateCents,
      backlogCents: Math.max(0, contractValueCents - billedToDateCents),
    });
    cur = nextYyyymm(cur);
  }

  return {
    rollup: { monthsConsidered: rows.length },
    rows,
  };
}
