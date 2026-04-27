// One-row-per-job dashboard composite.
//
// Plain English: Ryan + Brook want a single screen with one row per
// active job, each cell answering a different "is this job healthy?"
// question — % complete, open punch items, open RFIs, open
// submittals, retention outstanding, last daily report date. Pure
// derivation — composes existing record types.

import type { Job } from './job';
import type { PunchItem } from './punch-list';
import type { Rfi } from './rfi';
import type { Submittal } from './submittal';
import type { DailyReport } from './daily-report';
import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';

export type JobHealthFlag =
  | 'CLEAN'        // nothing on fire
  | 'WATCH'        // something open but normal
  | 'ATTENTION'    // open punch + RFI + submittal mix needs eyes
  | 'STALE';       // no daily report in 14+ days on what should be active job

export interface JobDashboardRow {
  jobId: string;
  projectName: string;
  status: Job['status'];
  /** % cost-incurred / budget proxy. 0..1. Caller passes the budget
   *  map; rows without a budget show 0. */
  percentComplete: number;
  openPunchItems: number;
  safetyPunchItems: number;
  openRfis: number;
  openSubmittals: number;
  retentionOutstandingCents: number;
  /** Most recent submitted daily report date for the job (null if
   *  never reported). */
  lastDailyReportOn: string | null;
  /** Days since last daily report. Null when never reported. */
  daysSinceLastReport: number | null;
  flag: JobHealthFlag;
}

export interface JobDashboardInputs {
  /** ISO yyyy-mm-dd; defaults to today (UTC). */
  asOf?: string;
  jobs: Job[];
  punchItems?: PunchItem[];
  rfis?: Rfi[];
  submittals?: Submittal[];
  dailyReports?: DailyReport[];
  arInvoices?: ArInvoice[];
  arPayments?: ArPayment[];
  /** Map<jobId, percentComplete fraction (0..1)>. */
  percentCompleteByJobId?: Map<string, number>;
}

export function buildJobDashboard(
  inputs: JobDashboardInputs,
): { rows: JobDashboardRow[] } {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const pctMap = inputs.percentCompleteByJobId ?? new Map<string, number>();

  // Pre-aggregate counts per job.
  const punchByJob = new Map<string, { open: number; safety: number }>();
  for (const p of inputs.punchItems ?? []) {
    if (p.status === 'CLOSED' || p.status === 'WAIVED') continue;
    const cur = punchByJob.get(p.jobId) ?? { open: 0, safety: 0 };
    cur.open += 1;
    if (p.severity === 'SAFETY') cur.safety += 1;
    punchByJob.set(p.jobId, cur);
  }

  const rfiByJob = new Map<string, number>();
  for (const r of inputs.rfis ?? []) {
    if (r.status !== 'DRAFT' && r.status !== 'SENT') continue;
    rfiByJob.set(r.jobId, (rfiByJob.get(r.jobId) ?? 0) + 1);
  }

  const submittalByJob = new Map<string, number>();
  for (const s of inputs.submittals ?? []) {
    if (s.status !== 'SUBMITTED' && s.status !== 'REVISE_RESUBMIT') continue;
    submittalByJob.set(s.jobId, (submittalByJob.get(s.jobId) ?? 0) + 1);
  }

  const lastDrByJob = new Map<string, string>();
  for (const dr of inputs.dailyReports ?? []) {
    if (!dr.submitted) continue;
    const cur = lastDrByJob.get(dr.jobId);
    if (!cur || dr.date > cur) lastDrByJob.set(dr.jobId, dr.date);
  }

  const retentionHeldByJob = new Map<string, number>();
  for (const inv of inputs.arInvoices ?? []) {
    if (inv.status === 'DRAFT' || inv.status === 'WRITTEN_OFF') continue;
    const ret = inv.retentionCents ?? 0;
    if (ret === 0) continue;
    retentionHeldByJob.set(
      inv.jobId,
      (retentionHeldByJob.get(inv.jobId) ?? 0) + ret,
    );
  }
  const retentionReleasedByJob = new Map<string, number>();
  for (const p of inputs.arPayments ?? []) {
    if (p.kind !== 'RETENTION_RELEASE') continue;
    retentionReleasedByJob.set(
      p.jobId,
      (retentionReleasedByJob.get(p.jobId) ?? 0) + p.amountCents,
    );
  }

  const rows: JobDashboardRow[] = [];

  for (const j of inputs.jobs) {
    const punch = punchByJob.get(j.id) ?? { open: 0, safety: 0 };
    const rfi = rfiByJob.get(j.id) ?? 0;
    const sub = submittalByJob.get(j.id) ?? 0;
    const lastDr = lastDrByJob.get(j.id) ?? null;
    const daysSince = lastDr ? Math.max(0, daysBetween(lastDr, asOf)) : null;

    const held = retentionHeldByJob.get(j.id) ?? 0;
    const released = retentionReleasedByJob.get(j.id) ?? 0;
    const retentionOutstanding = Math.max(0, held - released);

    let flag: JobHealthFlag;
    if (daysSince != null && daysSince > 14 && j.status === 'AWARDED') {
      flag = 'STALE';
    } else if (punch.safety > 0 || (punch.open + rfi + sub) >= 5) {
      flag = 'ATTENTION';
    } else if (punch.open > 0 || rfi > 0 || sub > 0) {
      flag = 'WATCH';
    } else {
      flag = 'CLEAN';
    }

    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      status: j.status,
      percentComplete: clamp01(pctMap.get(j.id) ?? 0),
      openPunchItems: punch.open,
      safetyPunchItems: punch.safety,
      openRfis: rfi,
      openSubmittals: sub,
      retentionOutstandingCents: retentionOutstanding,
      lastDailyReportOn: lastDr,
      daysSinceLastReport: daysSince,
      flag,
    });
  }

  // Worst flag first; within tier, most open items first.
  const flagRank: Record<JobHealthFlag, number> = {
    ATTENTION: 0,
    STALE: 1,
    WATCH: 2,
    CLEAN: 3,
  };
  rows.sort((a, b) => {
    if (a.flag !== b.flag) return flagRank[a.flag] - flagRank[b.flag];
    return (b.openPunchItems + b.openRfis + b.openSubmittals)
      - (a.openPunchItems + a.openRfis + a.openSubmittals);
  });

  return { rows };
}

function clamp01(n: number): number {
  if (Number.isNaN(n) || n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function daysBetween(from: string, to: string): number {
  const f = Date.parse(`${from}T00:00:00Z`);
  const t = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(f) || Number.isNaN(t)) return 0;
  return Math.round((t - f) / (24 * 60 * 60 * 1000));
}
