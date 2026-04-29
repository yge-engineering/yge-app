// Per (job, month) toolbox-talk rollup.
//
// Plain English: bucket toolbox talks by (jobId, yyyy-mm of
// heldOn). Counts talks, distinct topics, distinct leaders,
// total + signed attendees. T8 §1509 expects weekly safety
// meetings — this view tells YGE which jobs went dark in a
// given month and need a make-up talk.
//
// Per row: jobId, month, talks, distinctTopics, distinctLeaders,
// totalAttendees, signedAttendees.
//
// Sort: jobId asc, month asc.
//
// Different from job-toolbox-summary (per-job all-time),
// toolbox-by-leader (per-leader), employee-toolbox-monthly
// (per-employee per-month — does the worker show up to talks?),
// toolbox-attendance-gap (per-worker gap detection).
//
// Pure derivation. No persisted records.

import type { ToolboxTalk } from './toolbox-talk';

export interface JobToolboxMonthlyRow {
  jobId: string;
  month: string;
  talks: number;
  distinctTopics: number;
  distinctLeaders: number;
  totalAttendees: number;
  signedAttendees: number;
}

export interface JobToolboxMonthlyRollup {
  jobsConsidered: number;
  monthsConsidered: number;
  totalTalks: number;
  unattributed: number;
}

export interface JobToolboxMonthlyInputs {
  toolboxTalks: ToolboxTalk[];
  /** Optional yyyy-mm bounds inclusive applied to heldOn. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildJobToolboxMonthly(
  inputs: JobToolboxMonthlyInputs,
): {
  rollup: JobToolboxMonthlyRollup;
  rows: JobToolboxMonthlyRow[];
} {
  type Acc = {
    jobId: string;
    month: string;
    talks: number;
    topics: Set<string>;
    leaders: Set<string>;
    totalAttendees: number;
    signedAttendees: number;
  };
  const accs = new Map<string, Acc>();
  const jobs = new Set<string>();
  const months = new Set<string>();

  let totalTalks = 0;
  let unattributed = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const t of inputs.toolboxTalks) {
    const month = t.heldOn.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;
    if (!t.jobId) {
      unattributed += 1;
      continue;
    }
    const key = `${t.jobId}__${month}`;
    let a = accs.get(key);
    if (!a) {
      a = {
        jobId: t.jobId,
        month,
        talks: 0,
        topics: new Set(),
        leaders: new Set(),
        totalAttendees: 0,
        signedAttendees: 0,
      };
      accs.set(key, a);
    }
    a.talks += 1;
    a.topics.add(t.topic.toLowerCase().trim());
    a.leaders.add(t.leaderName);
    const attendees = t.attendees ?? [];
    a.totalAttendees += attendees.length;
    for (const at of attendees) {
      if (at.signed) a.signedAttendees += 1;
    }

    jobs.add(t.jobId);
    months.add(month);
    totalTalks += 1;
  }

  const rows: JobToolboxMonthlyRow[] = [...accs.values()]
    .map((a) => ({
      jobId: a.jobId,
      month: a.month,
      talks: a.talks,
      distinctTopics: a.topics.size,
      distinctLeaders: a.leaders.size,
      totalAttendees: a.totalAttendees,
      signedAttendees: a.signedAttendees,
    }))
    .sort((x, y) => {
      if (x.jobId !== y.jobId) return x.jobId.localeCompare(y.jobId);
      return x.month.localeCompare(y.month);
    });

  return {
    rollup: {
      jobsConsidered: jobs.size,
      monthsConsidered: months.size,
      totalTalks,
      unattributed,
    },
    rows,
  };
}
