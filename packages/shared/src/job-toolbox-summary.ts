// Per-job toolbox-talk summary.
//
// Plain English: roll the toolbox-talk log up by jobId — total
// talks, distinct topics, distinct leaders, total attendees, last
// heldOn. T8 §1509 doesn't mandate per-job records, but for any
// AWARDED job a Cal/OSHA inspector will ask "show me your safety
// talks for this site" — better to have it indexed.
//
// Per row: jobId, talks, distinctTopics, distinctLeaders,
// totalAttendees, signedAttendees, lastHeldOn.
//
// Sort by lastHeldOn desc (most recent activity first).
//
// Different from toolbox-by-leader (per-leader),
// toolbox-attendance-gap (per-employee gap),
// toolbox-topic-recency (per-topic), toolbox-compliance
// (overall). This is the per-job index.
//
// Pure derivation. No persisted records.

import type { ToolboxTalk } from './toolbox-talk';

export interface JobToolboxSummaryRow {
  jobId: string;
  talks: number;
  distinctTopics: number;
  distinctLeaders: number;
  totalAttendees: number;
  signedAttendees: number;
  lastHeldOn: string | null;
}

export interface JobToolboxSummaryRollup {
  jobsConsidered: number;
  totalTalks: number;
  unattributed: number;
}

export interface JobToolboxSummaryInputs {
  toolboxTalks: ToolboxTalk[];
  /** Optional yyyy-mm-dd window applied to heldOn. */
  fromDate?: string;
  toDate?: string;
}

export function buildJobToolboxSummary(
  inputs: JobToolboxSummaryInputs,
): {
  rollup: JobToolboxSummaryRollup;
  rows: JobToolboxSummaryRow[];
} {
  type Acc = {
    jobId: string;
    talks: number;
    topics: Set<string>;
    leaders: Set<string>;
    attendees: number;
    signed: number;
    lastHeldOn: string | null;
  };
  const accs = new Map<string, Acc>();
  let totalTalks = 0;
  let unattributed = 0;

  for (const t of inputs.toolboxTalks) {
    if (inputs.fromDate && t.heldOn < inputs.fromDate) continue;
    if (inputs.toDate && t.heldOn > inputs.toDate) continue;
    totalTalks += 1;
    const jobId = (t.jobId ?? '').trim();
    if (!jobId) {
      unattributed += 1;
      continue;
    }
    const acc = accs.get(jobId) ?? {
      jobId,
      talks: 0,
      topics: new Set<string>(),
      leaders: new Set<string>(),
      attendees: 0,
      signed: 0,
      lastHeldOn: null,
    };
    acc.talks += 1;
    acc.topics.add(t.topic.trim().toLowerCase());
    if (t.leaderName.trim()) acc.leaders.add(t.leaderName.trim().toLowerCase());
    acc.attendees += t.attendees.length;
    for (const a of t.attendees) if (a.signed) acc.signed += 1;
    if (!acc.lastHeldOn || t.heldOn > acc.lastHeldOn) acc.lastHeldOn = t.heldOn;
    accs.set(jobId, acc);
  }

  const rows: JobToolboxSummaryRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      jobId: acc.jobId,
      talks: acc.talks,
      distinctTopics: acc.topics.size,
      distinctLeaders: acc.leaders.size,
      totalAttendees: acc.attendees,
      signedAttendees: acc.signed,
      lastHeldOn: acc.lastHeldOn,
    });
  }

  rows.sort((a, b) => {
    if (a.lastHeldOn == null && b.lastHeldOn == null) return 0;
    if (a.lastHeldOn == null) return 1;
    if (b.lastHeldOn == null) return -1;
    return b.lastHeldOn.localeCompare(a.lastHeldOn);
  });

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalTalks,
      unattributed,
    },
    rows,
  };
}
