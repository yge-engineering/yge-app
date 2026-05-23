// Prevailing-wage deadline calendar.
//
// Given a list of awarded PW jobs, roll up the upcoming DAS-140,
// PWC-100, and CPR deadlines so the office sees one unified list of
// what's due, when, and whether it's past, urgent, or upcoming.
//
// Deadlines covered:
//   DAS_140    — 10 calendar days from award (8 CCR §230.1).
//                Required per applicable craft; this module emits ONE
//                row per craft listed on the job.
//   PWC_100    — 5 business days from award (8 CCR §16451).
//                Single row per job.
//   CPR_WEEKLY — every Sunday during construction (24 CCR §16401).
//                We emit the NEXT Sunday after the as-of date as the
//                upcoming deadline (the office can scroll back for
//                missed weeks on the certified-payroll list page).
//
// All deadlines are computed from `awardDate` (DAS-140 / PWC-100) or
// `asOfDate` (CPR). Pure: no clock dependency.

import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const PwDeadlineKindSchema = z.enum(['DAS_140', 'PWC_100', 'CPR_WEEKLY']);
export type PwDeadlineKind = z.infer<typeof PwDeadlineKindSchema>;

export const PwAwardedJobSchema = z.object({
  id: z.string().min(1),
  projectName: z.string().min(1).max(300),
  /** Date the contract was awarded, yyyy-mm-dd. */
  awardDate: z.string().regex(ISO_DATE, 'Use yyyy-mm-dd'),
  /** Crafts on the job — one DAS_140 row per craft. */
  crafts: z.array(z.string().min(1).max(120)).default([]),
  /** Set when CPRs have already been started for the job (so we don't
   *  hassle the office about a CPR for a still-mobilizing job). */
  cprStarted: z.boolean().default(false),
});
export type PwAwardedJob = z.infer<typeof PwAwardedJobSchema>;

export type PwDeadlineStatus = 'PAST' | 'URGENT' | 'UPCOMING';

export interface PwDeadlineRow {
  jobId: string;
  projectName: string;
  kind: PwDeadlineKind;
  /** For DAS_140: the applicable craft. For others: undefined. */
  craft?: string;
  /** Deadline date, yyyy-mm-dd. */
  dueDate: string;
  /** Days from asOfDate to dueDate. Negative = past. */
  daysUntilDue: number;
  status: PwDeadlineStatus;
}

export interface BuildPwCalendarInput {
  jobs: PwAwardedJob[];
  asOfDate: string;
  /** "Urgent" threshold — days-from-asOf at or under which a deadline
   *  is flagged URGENT. Default 3 (calendar days). */
  urgentWithinDays?: number;
}

const URGENT_DEFAULT = 3;

export function buildPwCalendar(input: BuildPwCalendarInput): PwDeadlineRow[] {
  const urgent = input.urgentWithinDays ?? URGENT_DEFAULT;
  const out: PwDeadlineRow[] = [];

  for (const job of input.jobs) {
    // DAS-140 — one per craft, 10 calendar days from award.
    for (const craft of job.crafts) {
      const due = addCalendarDays(job.awardDate, 10);
      out.push(mkRow(job, 'DAS_140', due, input.asOfDate, urgent, craft));
    }

    // PWC-100 — 5 business days from award.
    {
      const due = addBusinessDays(job.awardDate, 5);
      out.push(mkRow(job, 'PWC_100', due, input.asOfDate, urgent));
    }

    // CPR — emit only when the job is in active construction.
    if (job.cprStarted) {
      const due = nextSunday(input.asOfDate);
      out.push(mkRow(job, 'CPR_WEEKLY', due, input.asOfDate, urgent));
    }
  }

  // Sort by status priority (PAST > URGENT > UPCOMING) then by due date.
  const statusRank: Record<PwDeadlineStatus, number> = {
    PAST: 0,
    URGENT: 1,
    UPCOMING: 2,
  };
  out.sort((a, b) => {
    const s = statusRank[a.status] - statusRank[b.status];
    if (s !== 0) return s;
    return a.dueDate.localeCompare(b.dueDate);
  });
  return out;
}

/** Filter to just the rows the office should act on. */
export function actionableRows(rows: PwDeadlineRow[]): PwDeadlineRow[] {
  return rows.filter((r) => r.status !== 'UPCOMING');
}

function mkRow(
  job: PwAwardedJob,
  kind: PwDeadlineKind,
  dueDate: string,
  asOfDate: string,
  urgentWithinDays: number,
  craft?: string,
): PwDeadlineRow {
  const days = daysBetween(asOfDate, dueDate);
  const status: PwDeadlineStatus =
    days < 0 ? 'PAST' : days <= urgentWithinDays ? 'URGENT' : 'UPCOMING';
  return {
    jobId: job.id,
    projectName: job.projectName,
    kind,
    craft,
    dueDate,
    daysUntilDue: days,
    status,
  };
}

// ---- date helpers ----

function parseIso(s: string): number {
  return Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
}
function formatIso(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
function daysBetween(a: string, b: string): number {
  return Math.floor((parseIso(b) - parseIso(a)) / (1000 * 60 * 60 * 24));
}
function addCalendarDays(iso: string, days: number): string {
  return formatIso(parseIso(iso) + days * 1000 * 60 * 60 * 24);
}
function addBusinessDays(iso: string, days: number): string {
  let cursor = parseIso(iso);
  let remaining = days;
  while (remaining > 0) {
    cursor += 1000 * 60 * 60 * 24;
    const dow = new Date(cursor).getUTCDay();
    if (dow !== 0 && dow !== 6) remaining -= 1;
  }
  return formatIso(cursor);
}
function nextSunday(iso: string): string {
  let cursor = parseIso(iso);
  // Want the NEXT Sunday strictly after `iso`. If today IS a Sunday,
  // CPR for "this week" is due today — return today.
  const todayDow = new Date(cursor).getUTCDay();
  if (todayDow === 0) return iso;
  const daysAhead = 7 - todayDow; // Mon=1 → 6, Sat=6 → 1
  cursor += daysAhead * 1000 * 60 * 60 * 24;
  return formatIso(cursor);
}
