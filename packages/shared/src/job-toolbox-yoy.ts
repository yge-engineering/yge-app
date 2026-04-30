// Job-anchored toolbox-talk year-over-year.
//
// Plain English: for one job, collapse two years of toolbox
// talks into a comparison: counts, distinct topics + leaders,
// total + signed attendees, plus deltas.
//
// Pure derivation. No persisted records.

import type { ToolboxTalk } from './toolbox-talk';

export interface JobToolboxYoyResult {
  jobId: string;
  priorYear: number;
  currentYear: number;
  priorTotal: number;
  priorDistinctTopics: number;
  priorDistinctLeaders: number;
  priorTotalAttendees: number;
  priorSignedAttendees: number;
  currentTotal: number;
  currentDistinctTopics: number;
  currentDistinctLeaders: number;
  currentTotalAttendees: number;
  currentSignedAttendees: number;
  totalDelta: number;
}

export interface JobToolboxYoyInputs {
  jobId: string;
  toolboxTalks: ToolboxTalk[];
  currentYear: number;
}

export function buildJobToolboxYoy(
  inputs: JobToolboxYoyInputs,
): JobToolboxYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    total: number;
    topics: Set<string>;
    leaders: Set<string>;
    totalAttendees: number;
    signedAttendees: number;
  };
  function emptyBucket(): Bucket {
    return { total: 0, topics: new Set(), leaders: new Set(), totalAttendees: 0, signedAttendees: 0 };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const t of inputs.toolboxTalks) {
    if (t.jobId !== inputs.jobId) continue;
    const year = Number(t.heldOn.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.total += 1;
    if (t.topic) b.topics.add(t.topic.trim().toLowerCase());
    if (t.leaderName) b.leaders.add(t.leaderName.trim().toLowerCase());
    for (const a of t.attendees ?? []) {
      b.totalAttendees += 1;
      if (a.signed) b.signedAttendees += 1;
    }
  }

  return {
    jobId: inputs.jobId,
    priorYear,
    currentYear: inputs.currentYear,
    priorTotal: prior.total,
    priorDistinctTopics: prior.topics.size,
    priorDistinctLeaders: prior.leaders.size,
    priorTotalAttendees: prior.totalAttendees,
    priorSignedAttendees: prior.signedAttendees,
    currentTotal: current.total,
    currentDistinctTopics: current.topics.size,
    currentDistinctLeaders: current.leaders.size,
    currentTotalAttendees: current.totalAttendees,
    currentSignedAttendees: current.signedAttendees,
    totalDelta: current.total - prior.total,
  };
}
