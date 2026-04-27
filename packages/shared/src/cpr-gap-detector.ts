// Certified Payroll (CPR) gap detector.
//
// Plain English: California public-works contracts require a Form
// A-1-131 (or DIR equivalent) certified payroll record for every
// week of work on the job. Skip a week and the DIR auditor will
// catch it on the way out.
//
// This walks the CPR set for a given job (or every PW job) and
// flags:
//   - Missing weeks (gap between weekStarting dates that should
//     have had a CPR if hours were worked).
//   - Out-of-sequence payrollNumber values.
//   - Weeks where time-card hours exist but no CPR is on file
//     (the strongest gap signal — labor was billed but not certified).
//
// Pure derivation. No persisted records.
//
// "Filed" CPRs include SUBMITTED, ACCEPTED, AMENDED, and
// NON_PERFORMANCE (the "no work performed this week" filing also
// proves the week was reported). DRAFT is filtered out.

import type { CertifiedPayroll } from './certified-payroll';
import type { TimeCard } from './time-card';

export type CprGapReason =
  | 'TIME_CARDS_NO_CPR'   // hours worked, no CPR on file
  | 'WEEK_GAP'            // weekStarting between two CPRs has no record
  | 'NUMBER_OUT_OF_SEQUENCE';  // payrollNumber sequence broken

export interface CprGap {
  jobId: string;
  weekStarting: string;
  reason: CprGapReason;
  detail: string;
  /** When the gap is from time-card hours, this is the total hours
   *  on file for that week. */
  hoursOnFile?: number;
}

export interface CprJobAudit {
  jobId: string;
  /** Number of CPRs filed (excluding REJECTED / DRAFT). */
  cprsFiled: number;
  /** Distinct weekStarting values across the filed CPRs. */
  weeksCovered: number;
  /** Earliest weekStarting in the CPR set. */
  firstWeek: string | null;
  /** Latest weekStarting. */
  lastWeek: string | null;
  /** Gaps detected for this job. */
  gaps: CprGap[];
  /** True iff gaps.length === 0. */
  clean: boolean;
}

export interface CprGapReport {
  asOf: string;
  jobs: CprJobAudit[];
  totalGaps: number;
}

export interface CprGapInputs {
  /** ISO yyyy-mm-dd; defaults to today (UTC). */
  asOf?: string;
  certifiedPayrolls: CertifiedPayroll[];
  /** Optional time cards. When provided, weeks with hours but no
   *  CPR are flagged TIME_CARDS_NO_CPR. */
  timeCards?: TimeCard[];
  /** Optional restriction to a single job. */
  jobId?: string;
}

export function buildCprGapReport(inputs: CprGapInputs): CprGapReport {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);

  // Filter CPRs we trust as "filed". Counts SUBMITTED + ACCEPTED +
  // AMENDED + NON_PERFORMANCE (the "no work performed" filing still
  // proves the week was filed). Excludes DRAFT.
  let cprs = inputs.certifiedPayrolls.filter((c) => c.status !== 'DRAFT');
  if (inputs.jobId) cprs = cprs.filter((c) => c.jobId === inputs.jobId);

  // Group CPRs by job.
  const cprsByJob = new Map<string, CertifiedPayroll[]>();
  for (const c of cprs) {
    const list = cprsByJob.get(c.jobId) ?? [];
    list.push(c);
    cprsByJob.set(c.jobId, list);
  }

  // Group time cards by job + weekStarting.
  const tcByJobWeek = new Map<string, Map<string, number>>();
  for (const tc of inputs.timeCards ?? []) {
    if (inputs.jobId) {
      // Time cards aren't tagged to a single job (entries have jobIds);
      // count any entry whose jobId matches the filter.
      const entries = tc.entries ?? [];
      const onJob = entries.some((e) => e.jobId === inputs.jobId);
      if (!onJob) continue;
    }
    // For each entry's jobId in the card, attribute the entry's hours
    // to (jobId, weekStarting).
    const weekStart = tc.weekStarting;
    const entries = tc.entries ?? [];
    if (entries.length === 0) continue;
    const minutesByJob = new Map<string, number>();
    for (const e of entries) {
      const m = entryWorkedMinutes(e.startTime, e.endTime, e.lunchOut, e.lunchIn);
      minutesByJob.set(
        e.jobId,
        (minutesByJob.get(e.jobId) ?? 0) + m,
      );
    }
    for (const [jobId, minutes] of minutesByJob) {
      const inner = tcByJobWeek.get(jobId) ?? new Map<string, number>();
      inner.set(weekStart, (inner.get(weekStart) ?? 0) + minutes / 60);
      tcByJobWeek.set(jobId, inner);
    }
  }

  // Walk each job that has either a CPR or time-card hours.
  const jobIds = new Set<string>();
  for (const id of cprsByJob.keys()) jobIds.add(id);
  for (const id of tcByJobWeek.keys()) jobIds.add(id);

  const jobs: CprJobAudit[] = [];
  for (const jobId of jobIds) {
    const list = (cprsByJob.get(jobId) ?? []).slice().sort(
      (a, b) => a.weekStarting.localeCompare(b.weekStarting),
    );
    const weeksCovered = new Set(list.map((c) => c.weekStarting));

    const gaps: CprGap[] = [];

    // Time-card weeks with no CPR.
    const tcWeeks = tcByJobWeek.get(jobId) ?? new Map();
    for (const [weekStart, hours] of tcWeeks) {
      if (weekStart > asOf) continue;
      if (weeksCovered.has(weekStart)) continue;
      gaps.push({
        jobId,
        weekStarting: weekStart,
        reason: 'TIME_CARDS_NO_CPR',
        detail: `${hours.toFixed(1)} hrs of time-card labor on file with no CPR.`,
        hoursOnFile: Math.round(hours * 100) / 100,
      });
    }

    // Walk CPR sequence and find numbering gaps.
    let prevNumber = -1;
    let prevWeekStart: string | null = null;
    for (const c of list) {
      if (
        prevNumber >= 0 &&
        c.payrollNumber !== prevNumber + 1
      ) {
        gaps.push({
          jobId,
          weekStarting: c.weekStarting,
          reason: 'NUMBER_OUT_OF_SEQUENCE',
          detail: `payrollNumber jumped from ${prevNumber} to ${c.payrollNumber}.`,
        });
      }
      // Walk-week gap: if prevWeekStart + 7 != current weekStart and
      // there are no time-card hours covering the missing week, log
      // a WEEK_GAP. (If there ARE hours, TIME_CARDS_NO_CPR already
      // captured it above.)
      if (prevWeekStart) {
        let cursor = addDays(prevWeekStart, 7);
        while (cursor < c.weekStarting) {
          if (
            !tcWeeks.has(cursor) && // not already flagged
            cursor <= asOf
          ) {
            gaps.push({
              jobId,
              weekStarting: cursor,
              reason: 'WEEK_GAP',
              detail: `No CPR on file between payroll #${prevNumber} and #${c.payrollNumber}.`,
            });
          }
          cursor = addDays(cursor, 7);
        }
      }
      prevNumber = c.payrollNumber;
      prevWeekStart = c.weekStarting;
    }

    // Sort gaps by weekStarting ascending.
    gaps.sort((a, b) => a.weekStarting.localeCompare(b.weekStarting));

    jobs.push({
      jobId,
      cprsFiled: list.length,
      weeksCovered: weeksCovered.size,
      firstWeek: list[0]?.weekStarting ?? null,
      lastWeek: list[list.length - 1]?.weekStarting ?? null,
      gaps,
      clean: gaps.length === 0,
    });
  }

  // Sort jobs by gap count desc, then jobId.
  jobs.sort((a, b) => {
    if (b.gaps.length !== a.gaps.length) return b.gaps.length - a.gaps.length;
    return a.jobId.localeCompare(b.jobId);
  });

  return {
    asOf,
    jobs,
    totalGaps: jobs.reduce((s, j) => s + j.gaps.length, 0),
  };
}

// ---- helpers ------------------------------------------------------

function entryWorkedMinutes(
  start: string,
  end: string,
  lunchOut: string | undefined,
  lunchIn: string | undefined,
): number {
  const s = parseHHMM(start);
  const e = parseHHMM(end);
  if (s == null || e == null) return 0;
  let total = e - s;
  if (total < 0) total += 24 * 60;
  const lo = parseHHMM(lunchOut);
  const li = parseHHMM(lunchIn);
  if (lo != null && li != null && li > lo) total -= li - lo;
  return Math.max(0, total);
}

function parseHHMM(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function addDays(d: string, n: number): string {
  const t = Date.parse(`${d}T00:00:00Z`);
  if (Number.isNaN(t)) return d;
  return new Date(t + n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
