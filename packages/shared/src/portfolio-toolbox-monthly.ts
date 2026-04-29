// Portfolio toolbox-talk activity by month.
//
// Plain English: per yyyy-mm of heldOn, count talks, distinct
// topics + leaders, total + signed attendees, distinct jobs.
// Drives the IIPP coordinator's monthly safety-meeting trend
// and the T8 §1509 paper trail.
//
// Per row: month, talks, distinctTopics, distinctLeaders,
// totalAttendees, signedAttendees, distinctJobs.
//
// Sort: month asc.
//
// Different from toolbox-by-leader (per leader),
// employee-toolbox-monthly (per employee), customer-toolbox-
// monthly (per customer), job-toolbox-monthly (per job).
//
// Pure derivation. No persisted records.

import type { ToolboxTalk } from './toolbox-talk';

export interface PortfolioToolboxMonthlyRow {
  month: string;
  talks: number;
  distinctTopics: number;
  distinctLeaders: number;
  totalAttendees: number;
  signedAttendees: number;
  distinctJobs: number;
}

export interface PortfolioToolboxMonthlyRollup {
  monthsConsidered: number;
  totalTalks: number;
}

export interface PortfolioToolboxMonthlyInputs {
  toolboxTalks: ToolboxTalk[];
  fromMonth?: string;
  toMonth?: string;
}

export function buildPortfolioToolboxMonthly(
  inputs: PortfolioToolboxMonthlyInputs,
): {
  rollup: PortfolioToolboxMonthlyRollup;
  rows: PortfolioToolboxMonthlyRow[];
} {
  type Acc = {
    month: string;
    talks: number;
    topics: Set<string>;
    leaders: Set<string>;
    totalAttendees: number;
    signedAttendees: number;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();
  let totalTalks = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const t of inputs.toolboxTalks) {
    const month = t.heldOn.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;
    let a = accs.get(month);
    if (!a) {
      a = {
        month,
        talks: 0,
        topics: new Set(),
        leaders: new Set(),
        totalAttendees: 0,
        signedAttendees: 0,
        jobs: new Set(),
      };
      accs.set(month, a);
    }
    a.talks += 1;
    a.topics.add(t.topic.toLowerCase().trim());
    a.leaders.add(t.leaderName);
    const attendees = t.attendees ?? [];
    a.totalAttendees += attendees.length;
    for (const at of attendees) if (at.signed) a.signedAttendees += 1;
    if (t.jobId) a.jobs.add(t.jobId);
    totalTalks += 1;
  }

  const rows: PortfolioToolboxMonthlyRow[] = [...accs.values()]
    .map((a) => ({
      month: a.month,
      talks: a.talks,
      distinctTopics: a.topics.size,
      distinctLeaders: a.leaders.size,
      totalAttendees: a.totalAttendees,
      signedAttendees: a.signedAttendees,
      distinctJobs: a.jobs.size,
    }))
    .sort((x, y) => x.month.localeCompare(y.month));

  return {
    rollup: { monthsConsidered: rows.length, totalTalks },
    rows,
  };
}
