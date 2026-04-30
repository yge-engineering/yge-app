// Job-anchored toolbox-talk snapshot.
//
// Plain English: for one job, as-of today, count toolbox talks,
// count distinct topics + leaders, sum total + signed
// attendees, surface YTD count + last talk date. Drives the
// right-now per-job safety-talk overview against T8 §1509(e).
//
// Pure derivation. No persisted records.

import type { ToolboxTalk } from './toolbox-talk';

export interface JobToolboxSnapshotResult {
  asOf: string;
  jobId: string;
  totalTalks: number;
  ytdTalks: number;
  distinctTopics: number;
  distinctLeaders: number;
  totalAttendees: number;
  signedAttendees: number;
  lastTalkDate: string | null;
}

export interface JobToolboxSnapshotInputs {
  jobId: string;
  toolboxTalks: ToolboxTalk[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
  /** Log year. Defaults to year of asOf. */
  logYear?: number;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function buildJobToolboxSnapshot(
  inputs: JobToolboxSnapshotInputs,
): JobToolboxSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const logYear = inputs.logYear ?? Number(asOf.slice(0, 4));

  const topics = new Set<string>();
  const leaders = new Set<string>();
  let totalTalks = 0;
  let ytdTalks = 0;
  let totalAttendees = 0;
  let signedAttendees = 0;
  let lastTalkDate: string | null = null;

  for (const t of inputs.toolboxTalks) {
    if (t.jobId !== inputs.jobId) continue;
    if (t.heldOn > asOf) continue;
    totalTalks += 1;
    if (Number(t.heldOn.slice(0, 4)) === logYear) ytdTalks += 1;
    if (t.topic) topics.add(t.topic.trim().toLowerCase());
    if (t.leaderName) leaders.add(t.leaderName.trim().toLowerCase());
    for (const a of t.attendees ?? []) {
      totalAttendees += 1;
      if (a.signed) signedAttendees += 1;
    }
    if (lastTalkDate == null || t.heldOn > lastTalkDate) lastTalkDate = t.heldOn;
  }

  return {
    asOf,
    jobId: inputs.jobId,
    totalTalks,
    ytdTalks,
    distinctTopics: topics.size,
    distinctLeaders: leaders.size,
    totalAttendees,
    signedAttendees,
    lastTalkDate,
  };
}
