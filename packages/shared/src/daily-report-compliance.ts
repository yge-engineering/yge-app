// Daily-report compliance tracker.
//
// Plain English: every job that gets dispatched should have a foreman-
// submitted daily report at the end of the day. Daily reports are the
// canonical source for crew hours, weather, what got done, and meal-
// break compliance. When a foreman skips, the bookkeeper has to chase
// them, time-card pay roll-ups break, and Cal Fire / Caltrans monthly
// billing packets go out short.
//
// This tracker walks dispatches + daily reports over a date range and
// reports compliance two ways:
//   1. By foreman — of all dispatched-days for this foreman, how
//      many had a submitted report? Ranks worst-first.
//   2. By job — same per job (catches problem jobs even if the
//      foreman rotates).
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';
import type { Dispatch } from './dispatch';
import type { Employee } from './employee';
import { fullName } from './employee';

/** Per-foreman compliance row. */
export interface DrComplianceForemanRow {
  foremanId: string;
  foremanName: string;
  /** Number of (jobId, date) pairs this foreman was dispatched to. */
  dispatchedDays: number;
  /** Of those, how many had a submitted daily report on the same day. */
  reportsSubmitted: number;
  /** Compliance rate, 0..1. */
  complianceRate: number;
  /** Distinct jobIds where reports are missing. */
  missingJobIds: string[];
}

export interface DrComplianceJobRow {
  jobId: string;
  /** Display name when caller provides the lookup. Falls back to jobId. */
  projectName: string;
  dispatchedDays: number;
  reportsSubmitted: number;
  complianceRate: number;
}

export interface DailyReportComplianceReport {
  start: string;
  end: string;
  /** Total dispatched-days in the period (POSTED + COMPLETED only). */
  totalDispatchedDays: number;
  /** Total submitted daily reports in the period. */
  totalReports: number;
  /** Compliance rate across the whole period. */
  blendedComplianceRate: number;

  byForeman: DrComplianceForemanRow[];
  byJob: DrComplianceJobRow[];
}

export interface DailyReportComplianceInputs {
  /** ISO yyyy-mm-dd inclusive. */
  start: string;
  end: string;
  dispatches: Dispatch[];
  dailyReports: DailyReport[];
  employees?: Employee[];
  /** Optional jobId → projectName lookup. */
  jobNamesById?: Map<string, string>;
}

export function buildDailyReportCompliance(
  inputs: DailyReportComplianceInputs,
): DailyReportComplianceReport {
  const { start, end, dispatches, dailyReports, employees, jobNamesById } = inputs;

  // Index foreman names from employees when available.
  const foremanNameById = new Map<string, string>();
  for (const e of employees ?? []) foremanNameById.set(e.id, fullName(e));

  // Index submitted daily reports by (jobId, date).
  const reportKeyset = new Set<string>();
  let totalReports = 0;
  for (const dr of dailyReports) {
    if (!dr.submitted) continue;
    if (dr.date < start || dr.date > end) continue;
    reportKeyset.add(`${dr.jobId}|${dr.date}`);
    totalReports += 1;
  }

  // Count of reports that match a dispatched (jobId, date). Drives the
  // blended compliance rate so a foreman who files reports on undispatched
  // emergency days doesn't push the rate over 1.
  let totalMatched = 0;

  // Walk dispatches in the period. The "foremanId" on a dispatch is
  // sometimes a name, not an id (the schema uses foremanName). Use
  // foremanName as the rollup key — if the caller has employees we
  // try to resolve via crew[].
  type Bucket = { dispatched: number; submitted: number; missingJobs: Set<string> };
  const byForemanKey = new Map<string, { name: string } & Bucket>();
  const byJob = new Map<string, Bucket>();

  let totalDispatchedDays = 0;
  for (const d of dispatches) {
    if (d.scheduledFor < start || d.scheduledFor > end) continue;
    if (d.status !== 'POSTED' && d.status !== 'COMPLETED') continue;
    totalDispatchedDays += 1;

    const haveReport = reportKeyset.has(`${d.jobId}|${d.scheduledFor}`);

    // Foreman bucket.
    const foremanKey = d.foremanName.trim().toLowerCase();
    const fbucket =
      byForemanKey.get(foremanKey) ??
      { name: d.foremanName, dispatched: 0, submitted: 0, missingJobs: new Set<string>() };
    fbucket.dispatched += 1;
    if (haveReport) {
      fbucket.submitted += 1;
      totalMatched += 1;
    } else {
      fbucket.missingJobs.add(d.jobId);
    }
    byForemanKey.set(foremanKey, fbucket);

    // Job bucket.
    const jbucket =
      byJob.get(d.jobId) ??
      { dispatched: 0, submitted: 0, missingJobs: new Set<string>() };
    jbucket.dispatched += 1;
    if (haveReport) jbucket.submitted += 1;
    byJob.set(d.jobId, jbucket);
  }

  const byForeman: DrComplianceForemanRow[] = [];
  for (const [, b] of byForemanKey) {
    byForeman.push({
      foremanId: foremanNameById.size > 0 ? findEmployeeIdByName(b.name, employees) ?? b.name : b.name,
      foremanName: b.name,
      dispatchedDays: b.dispatched,
      reportsSubmitted: b.submitted,
      complianceRate: b.dispatched === 0 ? 0 : b.submitted / b.dispatched,
      missingJobIds: Array.from(b.missingJobs).sort(),
    });
  }
  byForeman.sort((a, b) => a.complianceRate - b.complianceRate);

  const byJobRows: DrComplianceJobRow[] = [];
  for (const [jobId, b] of byJob) {
    byJobRows.push({
      jobId,
      projectName: jobNamesById?.get(jobId) ?? jobId,
      dispatchedDays: b.dispatched,
      reportsSubmitted: b.submitted,
      complianceRate: b.dispatched === 0 ? 0 : b.submitted / b.dispatched,
    });
  }
  byJobRows.sort((a, b) => a.complianceRate - b.complianceRate);

  return {
    start,
    end,
    totalDispatchedDays,
    totalReports,
    blendedComplianceRate:
      totalDispatchedDays === 0 ? 0 : totalMatched / totalDispatchedDays,
    byForeman,
    byJob: byJobRows,
  };
}

function findEmployeeIdByName(
  name: string,
  employees: Employee[] | undefined,
): string | null {
  if (!employees) return null;
  const target = name.trim().toLowerCase();
  for (const e of employees) {
    if (fullName(e).toLowerCase() === target) return e.id;
  }
  return null;
}
