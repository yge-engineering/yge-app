// Per-job AR billing cadence.
//
// Plain English: monthly billing is the most common rhythm on YGE
// jobs — Cal Fire, Caltrans, county and city all expect a monthly
// progress invoice. When a job's last invoice was 47 days ago,
// somebody's late on submitting and there's a chunk of cash
// sitting in unbilled work-in-progress.
//
// This walks AR invoices per AWARDED job and reports:
//   - invoice count + total billed in window
//   - days since last invoice
//   - average days between invoices (cadence)
//   - tier: ON_TRACK / SLIPPING / LATE / DARK / NEW_JOB
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';
import type { Job } from './job';

export type BillingCadenceFlag =
  | 'ON_TRACK'   // last invoice within 35 days, cadence ~monthly
  | 'SLIPPING'   // last invoice 36-49 days ago
  | 'LATE'       // 50-89 days
  | 'DARK'       // 90+ days
  | 'NEW_JOB';   // never invoiced — job is too new to score

export interface JobBillingCadenceRow {
  jobId: string;
  projectName: string;
  invoiceCount: number;
  totalBilledCents: number;
  /** Most recent invoiceDate. Null if never. */
  lastInvoiceDate: string | null;
  daysSinceLastInvoice: number | null;
  /** Average days between invoices. Null when <2 invoices. */
  avgDaysBetweenInvoices: number | null;
  flag: BillingCadenceFlag;
}

export interface JobBillingCadenceRollup {
  jobsConsidered: number;
  onTrack: number;
  slipping: number;
  late: number;
  dark: number;
  newJob: number;
  /** Total billed across all jobs in window. */
  totalBilledCents: number;
}

export interface JobBillingCadenceInputs {
  asOf?: string;
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  arInvoices: ArInvoice[];
  /** When false (default), only AWARDED jobs are scored. */
  includeAllStatuses?: boolean;
}

export function buildJobBillingCadence(
  inputs: JobBillingCadenceInputs,
): {
  rollup: JobBillingCadenceRollup;
  rows: JobBillingCadenceRow[];
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const refNow = new Date(`${asOf}T00:00:00Z`);
  const includeAll = inputs.includeAllStatuses === true;

  // Group non-DRAFT invoices by jobId.
  const byJob = new Map<string, ArInvoice[]>();
  for (const inv of inputs.arInvoices) {
    if (inv.status === 'DRAFT') continue;
    const list = byJob.get(inv.jobId) ?? [];
    list.push(inv);
    byJob.set(inv.jobId, list);
  }

  const rows: JobBillingCadenceRow[] = [];
  const counts = { onTrack: 0, slipping: 0, late: 0, dark: 0, newJob: 0 };
  let totalBilled = 0;

  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;

    const invs = (byJob.get(j.id) ?? []).slice().sort((a, b) =>
      a.invoiceDate.localeCompare(b.invoiceDate),
    );
    let totalForJob = 0;
    for (const inv of invs) totalForJob += inv.totalCents;

    const last = invs.length === 0 ? null : invs[invs.length - 1]!;
    const lastDate = last ? last.invoiceDate : null;
    const lastParsed = lastDate ? parseDate(lastDate) : null;
    const daysSince = lastParsed
      ? Math.max(0, daysBetween(lastParsed, refNow))
      : null;

    let avgGap: number | null = null;
    if (invs.length >= 2) {
      let totalGap = 0;
      let gapCount = 0;
      for (let i = 1; i < invs.length; i += 1) {
        const a = parseDate(invs[i - 1]!.invoiceDate);
        const b = parseDate(invs[i]!.invoiceDate);
        if (a && b) {
          totalGap += daysBetween(a, b);
          gapCount += 1;
        }
      }
      if (gapCount > 0) avgGap = round1(totalGap / gapCount);
    }

    let flag: BillingCadenceFlag;
    if (daysSince === null) flag = 'NEW_JOB';
    else if (daysSince <= 35) flag = 'ON_TRACK';
    else if (daysSince <= 49) flag = 'SLIPPING';
    else if (daysSince <= 89) flag = 'LATE';
    else flag = 'DARK';

    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      invoiceCount: invs.length,
      totalBilledCents: totalForJob,
      lastInvoiceDate: lastDate,
      daysSinceLastInvoice: daysSince,
      avgDaysBetweenInvoices: avgGap,
      flag,
    });
    totalBilled += totalForJob;

    if (flag === 'ON_TRACK') counts.onTrack += 1;
    else if (flag === 'SLIPPING') counts.slipping += 1;
    else if (flag === 'LATE') counts.late += 1;
    else if (flag === 'DARK') counts.dark += 1;
    else counts.newJob += 1;
  }

  // DARK first, then LATE, SLIPPING, ON_TRACK; NEW_JOB pinned bottom.
  const tierRank: Record<BillingCadenceFlag, number> = {
    DARK: 0,
    LATE: 1,
    SLIPPING: 2,
    ON_TRACK: 3,
    NEW_JOB: 4,
  };
  rows.sort((a, b) => {
    if (a.flag !== b.flag) return tierRank[a.flag] - tierRank[b.flag];
    const ad = a.daysSinceLastInvoice ?? -1;
    const bd = b.daysSinceLastInvoice ?? -1;
    return bd - ad;
  });

  return {
    rollup: {
      jobsConsidered: rows.length,
      onTrack: counts.onTrack,
      slipping: counts.slipping,
      late: counts.late,
      dark: counts.dark,
      newJob: counts.newJob,
      totalBilledCents: totalBilled,
    },
    rows,
  };
}

function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
