// Lien rights calendar — per-job deadlines under California mechanics-lien
// and prompt-payment law.
//
// The clocks we track (CA Civ. Code references in parentheses):
//
//   - PRELIMINARY_20_DAY (§8200, §8410)
//       Must be served within 20 days of FIRST furnishing labor / materials.
//       Missing it forfeits lien rights for work performed before the notice.
//
//   - MECHANICS_LIEN_90_DAY (§8412)
//       A mechanic's lien must be RECORDED within 90 days after completion
//       of work, OR 60 days after recordation of a Notice of Completion or
//       Notice of Cessation if the owner records one. (We track 90-day from
//       last work and a separate, shorter window if NOC was recorded.)
//
//   - MECHANICS_LIEN_60_DAY_POST_NOC (§8412)
//       If the owner records a Notice of Completion / Cessation, the lien
//       window shortens to 60 days for the direct contractor; 30 days for
//       sub-tier claimants. (Per the project plan, we surface the 30-day
//       window for YGE sub-tier work.)
//
//   - RETENTION_RELEASE_60_DAY (§7107)
//       For public-works, retention must be released within 60 days after
//       completion. Past that triggers §20104.50 prompt-pay interest.
//
// All dates are ISO `yyyy-mm-dd`. The helper is pure: today is passed in.

import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_SCHEMA = z.string().regex(ISO_DATE, 'Use yyyy-mm-dd');

export const LienJobTypeSchema = z.enum(['PUBLIC', 'PRIVATE']);
export type LienJobType = z.infer<typeof LienJobTypeSchema>;

export const LienRightsInputSchema = z.object({
  jobId: z.string().min(1).max(120),
  jobName: z.string().min(1).max(200),
  jobType: LienJobTypeSchema,
  /** Date of first furnishing labor / materials on this job. */
  firstWorkDate: ISO_DATE_SCHEMA.optional(),
  /** Date of last labor / materials furnished. */
  lastWorkDate: ISO_DATE_SCHEMA.optional(),
  /** Date the owner recorded a Notice of Completion / Cessation. */
  ncDate: ISO_DATE_SCHEMA.optional(),
  /** YGE acted as a sub-tier claimant (vs direct contractor)? Defaults true
   *  since YGE is most often a sub to a prime — affects the post-NOC window. */
  isSubTier: z.boolean().default(true),
  /** Records that already exist on this job (so we can mark COMPLETED). */
  prelimNoticeServed: z.boolean().default(false),
  prelimNoticeDate: ISO_DATE_SCHEMA.optional(),
  lienRecordedDate: ISO_DATE_SCHEMA.optional(),
  retentionReleasedDate: ISO_DATE_SCHEMA.optional(),
});
export type LienRightsInput = z.infer<typeof LienRightsInputSchema>;

export const LienRightTypeSchema = z.enum([
  'PRELIMINARY_20_DAY',
  'MECHANICS_LIEN_90_DAY',
  'MECHANICS_LIEN_POST_NOC',
  'RETENTION_RELEASE_60_DAY',
]);
export type LienRightType = z.infer<typeof LienRightTypeSchema>;

export type LienDeadlineStatus = 'PENDING' | 'PAST_DUE' | 'COMPLETED' | 'OK';

export interface LienDeadline {
  jobId: string;
  jobName: string;
  type: LienRightType;
  dueDate: string;
  status: LienDeadlineStatus;
  /** Days until due. Negative = past. 0 = today. */
  daysUntilDue: number;
  /** Plain-English explanation (incl. CA Civ. Code section). */
  description: string;
}

// --- Date helpers ------------------------------------------------------------

function parseISO(s: string): Date {
  return new Date(s + 'T00:00:00Z');
}
function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}
function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

// --- Main --------------------------------------------------------------------

export function computeLienDeadlines(
  input: LienRightsInput,
  today: string,
): LienDeadline[] {
  const out: LienDeadline[] = [];
  const todayDate = parseISO(today);

  if (input.firstWorkDate) {
    const due = addDays(parseISO(input.firstWorkDate), 20);
    const days = daysBetween(todayDate, due);
    out.push({
      jobId: input.jobId,
      jobName: input.jobName,
      type: 'PRELIMINARY_20_DAY',
      dueDate: formatDate(due),
      daysUntilDue: days,
      status: input.prelimNoticeServed
        ? 'COMPLETED'
        : days < 0
          ? 'PAST_DUE'
          : 'PENDING',
      description:
        '20-day preliminary notice (CA Civ. Code §8200, §8410). Must be served within 20 days of first furnishing labor or materials — required to preserve lien rights for work done before the notice.',
    });
  }

  if (input.lastWorkDate) {
    const due = addDays(parseISO(input.lastWorkDate), 90);
    const days = daysBetween(todayDate, due);
    out.push({
      jobId: input.jobId,
      jobName: input.jobName,
      type: 'MECHANICS_LIEN_90_DAY',
      dueDate: formatDate(due),
      daysUntilDue: days,
      status: input.lienRecordedDate
        ? 'COMPLETED'
        : days < 0
          ? 'PAST_DUE'
          : 'PENDING',
      description:
        "Mechanic's lien (CA Civ. Code §8412). Must be recorded within 90 days of completion of work on the project as a whole.",
    });
  }

  if (input.ncDate) {
    // Sub-tier claimants: 30 days post-NOC; direct contractors: 60 days.
    const window = input.isSubTier ? 30 : 60;
    const due = addDays(parseISO(input.ncDate), window);
    const days = daysBetween(todayDate, due);
    out.push({
      jobId: input.jobId,
      jobName: input.jobName,
      type: 'MECHANICS_LIEN_POST_NOC',
      dueDate: formatDate(due),
      daysUntilDue: days,
      status: input.lienRecordedDate
        ? 'COMPLETED'
        : days < 0
          ? 'PAST_DUE'
          : 'PENDING',
      description: `Mechanic's lien post-NOC (CA Civ. Code §8412). Once the owner recorded a Notice of Completion / Cessation, the lien window is ${window} days (${input.isSubTier ? 'sub-tier' : 'direct contractor'}).`,
    });
  }

  if (input.jobType === 'PUBLIC' && input.lastWorkDate) {
    const due = addDays(parseISO(input.lastWorkDate), 60);
    const days = daysBetween(todayDate, due);
    out.push({
      jobId: input.jobId,
      jobName: input.jobName,
      type: 'RETENTION_RELEASE_60_DAY',
      dueDate: formatDate(due),
      daysUntilDue: days,
      status: input.retentionReleasedDate
        ? 'COMPLETED'
        : days < 0
          ? 'PAST_DUE'
          : 'PENDING',
      description:
        'Retention release (CA Pub. Contract Code §7107). Must be released within 60 days of completion on public works; past that triggers §20104.50 prompt-pay interest at 10% / year.',
    });
  }

  // Sort: PAST_DUE first (sorted soonest-most-past), then PENDING (sorted by
  // soonest due), then COMPLETED.
  const priority: Record<LienDeadlineStatus, number> = {
    PAST_DUE: 0,
    PENDING: 1,
    OK: 2,
    COMPLETED: 3,
  };
  out.sort((a, b) => {
    const ps = priority[a.status] - priority[b.status];
    if (ps !== 0) return ps;
    return a.daysUntilDue - b.daysUntilDue;
  });
  return out;
}

/** Rollup across many jobs. */
export interface LienCalendarSummary {
  totalDeadlines: number;
  pastDue: number;
  dueWithin30: number;
  completed: number;
  /** Jobs with any past-due item. */
  jobsWithPastDue: number;
}

export function summarizeLienCalendar(deadlines: LienDeadline[]): LienCalendarSummary {
  const pastDue = deadlines.filter((d) => d.status === 'PAST_DUE').length;
  const dueWithin30 = deadlines.filter(
    (d) => d.status === 'PENDING' && d.daysUntilDue >= 0 && d.daysUntilDue <= 30,
  ).length;
  const completed = deadlines.filter((d) => d.status === 'COMPLETED').length;
  const jobsWithPastDue = new Set(
    deadlines.filter((d) => d.status === 'PAST_DUE').map((d) => d.jobId),
  ).size;
  return {
    totalDeadlines: deadlines.length,
    pastDue,
    dueWithin30,
    completed,
    jobsWithPastDue,
  };
}
