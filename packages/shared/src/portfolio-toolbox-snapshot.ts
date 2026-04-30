// Portfolio toolbox-talk snapshot.
//
// Plain English: as-of today (with optional logYear filter),
// count toolbox talks, distinct topics + leaders, total +
// signed attendees, distinct jobs. Drives the IIPP
// coordinator's right-now safety-meeting overview.
//
// Pure derivation. No persisted records.

import type { ToolboxTalk } from './toolbox-talk';

export interface PortfolioToolboxSnapshotResult {
  asOf: string;
  ytdLogYear: number;
  ytdTalks: number;
  totalTalks: number;
  distinctTopics: number;
  distinctLeaders: number;
  totalAttendees: number;
  signedAttendees: number;
  distinctJobs: number;
}

export interface PortfolioToolboxSnapshotInputs {
  toolboxTalks: ToolboxTalk[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
  /** Log year (Jan 1 - Dec 31). Defaults to year of asOf. */
  logYear?: number;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function buildPortfolioToolboxSnapshot(
  inputs: PortfolioToolboxSnapshotInputs,
): PortfolioToolboxSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const logYear = inputs.logYear ?? Number(asOf.slice(0, 4));

  const topics = new Set<string>();
  const leaders = new Set<string>();
  const jobs = new Set<string>();
  let totalTalks = 0;
  let ytdTalks = 0;
  let totalAttendees = 0;
  let signedAttendees = 0;

  for (const t of inputs.toolboxTalks) {
    if (t.heldOn > asOf) continue;
    totalTalks += 1;
    topics.add(t.topic.toLowerCase().trim());
    leaders.add(t.leaderName);
    if (t.jobId) jobs.add(t.jobId);
    const attendees = t.attendees ?? [];
    totalAttendees += attendees.length;
    for (const at of attendees) if (at.signed) signedAttendees += 1;
    if (Number(t.heldOn.slice(0, 4)) === logYear) ytdTalks += 1;
  }

  return {
    asOf,
    ytdLogYear: logYear,
    ytdTalks,
    totalTalks,
    distinctTopics: topics.size,
    distinctLeaders: leaders.size,
    totalAttendees,
    signedAttendees,
    distinctJobs: jobs.size,
  };
}
