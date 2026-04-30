// Job-anchored headcount snapshot.
//
// Plain English: for one job, as-of today, count distinct
// employees who appeared on either daily reports or timecards
// (any time on or before asOf). Optionally restrict to a
// trailing-N-day window. Surfaces total + active employees on
// the job and the last-seen-on-job date.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';
import type { Employee } from './employee';
import type { TimeCard } from './time-card';

export interface JobHeadcountSnapshotResult {
  asOf: string;
  jobId: string;
  windowDays: number | null;
  totalEmployeesEverOnJob: number;
  employeesInWindow: number;
  activeEmployeesInWindow: number;
  lastSeenOnJob: string | null;
}

export interface JobHeadcountSnapshotInputs {
  jobId: string;
  dailyReports: DailyReport[];
  timeCards: TimeCard[];
  employees: Employee[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
  /** When set, only employees who appeared in [asOf - N, asOf]. */
  windowDays?: number;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (y === undefined || m === undefined || d === undefined) return iso;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function buildJobHeadcountSnapshot(
  inputs: JobHeadcountSnapshotInputs,
): JobHeadcountSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const windowDays = inputs.windowDays ?? null;
  const windowStart = windowDays != null ? addDays(asOf, -windowDays) : null;

  const totalEver = new Set<string>();
  const inWindow = new Set<string>();
  let lastSeenOnJob: string | null = null;

  for (const r of inputs.dailyReports) {
    if (r.jobId !== inputs.jobId) continue;
    if (r.date > asOf) continue;
    for (const row of r.crewOnSite ?? []) {
      totalEver.add(row.employeeId);
      if (windowStart == null || r.date >= windowStart) inWindow.add(row.employeeId);
    }
    if (lastSeenOnJob == null || r.date > lastSeenOnJob) lastSeenOnJob = r.date;
  }
  for (const c of inputs.timeCards) {
    for (const e of c.entries) {
      if (e.jobId !== inputs.jobId) continue;
      if (e.date > asOf) continue;
      totalEver.add(c.employeeId);
      if (windowStart == null || e.date >= windowStart) inWindow.add(c.employeeId);
      if (lastSeenOnJob == null || e.date > lastSeenOnJob) lastSeenOnJob = e.date;
    }
  }

  const empById = new Map<string, Employee>();
  for (const e of inputs.employees) empById.set(e.id, e);

  let activeInWindow = 0;
  for (const id of inWindow) {
    const emp = empById.get(id);
    if (emp && emp.status === 'ACTIVE') activeInWindow += 1;
  }

  return {
    asOf,
    jobId: inputs.jobId,
    windowDays,
    totalEmployeesEverOnJob: totalEver.size,
    employeesInWindow: inWindow.size,
    activeEmployeesInWindow: activeInWindow,
    lastSeenOnJob,
  };
}
