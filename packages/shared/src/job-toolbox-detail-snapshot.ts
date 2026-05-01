// Job-anchored per-leader toolbox-talk detail snapshot.
//
// Plain English: for one job, return one row per meeting leader
// (foreman / safety director / etc.) on Cal/OSHA T8 §1509
// tailgate meetings: meeting count, total attendees, distinct
// topics covered, signed-attendance count, last held date.
// Sorted by meeting count desc.
//
// Pure derivation. No persisted records.

import type { ToolboxTalk } from './toolbox-talk';

export interface JobToolboxDetailRow {
  leaderName: string;
  meetings: number;
  totalAttendees: number;
  distinctTopics: number;
  signedAttendees: number;
  lastHeldDate: string | null;
}

export interface JobToolboxDetailSnapshotResult {
  asOf: string;
  jobId: string;
  rows: JobToolboxDetailRow[];
}

export interface JobToolboxDetailSnapshotInputs {
  jobId: string;
  toolboxTalks: ToolboxTalk[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildJobToolboxDetailSnapshot(
  inputs: JobToolboxDetailSnapshotInputs,
): JobToolboxDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  type Acc = {
    meetings: number;
    totalAttendees: number;
    topics: Set<string>;
    signed: number;
    lastDate: string | null;
  };
  const byLeader = new Map<string, Acc>();
  function getAcc(leader: string): Acc {
    let a = byLeader.get(leader);
    if (!a) {
      a = { meetings: 0, totalAttendees: 0, topics: new Set(), signed: 0, lastDate: null };
      byLeader.set(leader, a);
    }
    return a;
  }

  for (const t of inputs.toolboxTalks) {
    if (t.jobId !== inputs.jobId) continue;
    if (t.heldOn > asOf) continue;
    const a = getAcc(t.leaderName);
    a.meetings += 1;
    a.totalAttendees += t.attendees.length;
    a.signed += t.attendees.filter((att) => att.signed).length;
    a.topics.add(norm(t.topic));
    if (a.lastDate == null || t.heldOn > a.lastDate) a.lastDate = t.heldOn;
  }

  const rows: JobToolboxDetailRow[] = [...byLeader.entries()]
    .map(([leaderName, a]) => ({
      leaderName,
      meetings: a.meetings,
      totalAttendees: a.totalAttendees,
      distinctTopics: a.topics.size,
      signedAttendees: a.signed,
      lastHeldDate: a.lastDate,
    }))
    .sort((a, b) => b.meetings - a.meetings || a.leaderName.localeCompare(b.leaderName));

  return {
    asOf,
    jobId: inputs.jobId,
    rows,
  };
}
