// Per-leader toolbox-talk activity.
//
// Plain English: T8 §1509 requires periodic toolbox talks. Every
// talk on file names a leaderName + topic + attendees + heldOn.
// This rolls the talk log up by leader so we can see who's
// actually delivering safety talks vs who's letting compliance
// slide.
//
// Per row: leaderName, talks, distinctTopics, distinctJobs,
// totalAttendees, signedAttendees, lastHeldOn.
//
// Sort by talks desc.
//
// Different from toolbox-compliance (overall site compliance),
// employee-toolbox-rate (per-employee attendance rate),
// toolbox-attendance-gap (per-employee gap detector), and
// toolbox-topic-recency (per-topic last-discussed gap). This is
// the leader productivity view.
//
// Pure derivation. No persisted records.

import type { ToolboxTalk } from './toolbox-talk';

export interface ToolboxByLeaderRow {
  leaderName: string;
  talks: number;
  distinctTopics: number;
  distinctJobs: number;
  totalAttendees: number;
  signedAttendees: number;
  lastHeldOn: string | null;
}

export interface ToolboxByLeaderRollup {
  leadersConsidered: number;
  totalTalks: number;
  totalAttendees: number;
}

export interface ToolboxByLeaderInputs {
  toolboxTalks: ToolboxTalk[];
  /** Optional yyyy-mm-dd window applied to heldOn. */
  fromDate?: string;
  toDate?: string;
}

export function buildToolboxByLeader(
  inputs: ToolboxByLeaderInputs,
): {
  rollup: ToolboxByLeaderRollup;
  rows: ToolboxByLeaderRow[];
} {
  type Acc = {
    display: string;
    talks: number;
    topics: Set<string>;
    jobs: Set<string>;
    attendees: number;
    signed: number;
    lastHeldOn: string | null;
  };
  const accs = new Map<string, Acc>();
  let totalTalks = 0;
  let totalAttendees = 0;

  for (const t of inputs.toolboxTalks) {
    if (inputs.fromDate && t.heldOn < inputs.fromDate) continue;
    if (inputs.toDate && t.heldOn > inputs.toDate) continue;
    if (!t.leaderName.trim()) continue;
    totalTalks += 1;
    const key = t.leaderName.trim().toLowerCase();
    const acc = accs.get(key) ?? {
      display: t.leaderName.trim(),
      talks: 0,
      topics: new Set<string>(),
      jobs: new Set<string>(),
      attendees: 0,
      signed: 0,
      lastHeldOn: null,
    };
    acc.talks += 1;
    acc.topics.add(t.topic.trim().toLowerCase());
    if (t.jobId) acc.jobs.add(t.jobId);
    acc.attendees += t.attendees.length;
    for (const a of t.attendees) {
      if (a.signed) acc.signed += 1;
    }
    if (!acc.lastHeldOn || t.heldOn > acc.lastHeldOn) acc.lastHeldOn = t.heldOn;
    totalAttendees += t.attendees.length;
    accs.set(key, acc);
  }

  const rows: ToolboxByLeaderRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      leaderName: acc.display,
      talks: acc.talks,
      distinctTopics: acc.topics.size,
      distinctJobs: acc.jobs.size,
      totalAttendees: acc.attendees,
      signedAttendees: acc.signed,
      lastHeldOn: acc.lastHeldOn,
    });
  }

  rows.sort((a, b) => b.talks - a.talks);

  return {
    rollup: {
      leadersConsidered: rows.length,
      totalTalks,
      totalAttendees,
    },
    rows,
  };
}
