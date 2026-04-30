// Customer-anchored toolbox-talk year-over-year.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// collapse two years of toolbox-talk records into a comparison:
// counts, distinct topics + leaders, total + signed attendees,
// distinct jobs, plus deltas.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { ToolboxTalk } from './toolbox-talk';

export interface CustomerToolboxYoyResult {
  customerName: string;
  priorYear: number;
  currentYear: number;
  priorTotal: number;
  priorDistinctTopics: number;
  priorDistinctLeaders: number;
  priorDistinctJobs: number;
  priorTotalAttendees: number;
  priorSignedAttendees: number;
  currentTotal: number;
  currentDistinctTopics: number;
  currentDistinctLeaders: number;
  currentDistinctJobs: number;
  currentTotalAttendees: number;
  currentSignedAttendees: number;
  totalDelta: number;
}

export interface CustomerToolboxYoyInputs {
  customerName: string;
  toolboxTalks: ToolboxTalk[];
  jobs: Job[];
  currentYear: number;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildCustomerToolboxYoy(
  inputs: CustomerToolboxYoyInputs,
): CustomerToolboxYoyResult {
  const priorYear = inputs.currentYear - 1;
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Bucket = {
    total: number;
    topics: Set<string>;
    leaders: Set<string>;
    jobs: Set<string>;
    totalAttendees: number;
    signedAttendees: number;
  };
  function emptyBucket(): Bucket {
    return {
      total: 0,
      topics: new Set(),
      leaders: new Set(),
      jobs: new Set(),
      totalAttendees: 0,
      signedAttendees: 0,
    };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const t of inputs.toolboxTalks) {
    if (!t.jobId || !customerJobs.has(t.jobId)) continue;
    const year = Number(t.heldOn.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.total += 1;
    if (t.topic) b.topics.add(t.topic.trim().toLowerCase());
    if (t.leaderName) b.leaders.add(t.leaderName.trim().toLowerCase());
    b.jobs.add(t.jobId);
    for (const a of t.attendees ?? []) {
      b.totalAttendees += 1;
      if (a.signed) b.signedAttendees += 1;
    }
  }

  return {
    customerName: inputs.customerName,
    priorYear,
    currentYear: inputs.currentYear,
    priorTotal: prior.total,
    priorDistinctTopics: prior.topics.size,
    priorDistinctLeaders: prior.leaders.size,
    priorDistinctJobs: prior.jobs.size,
    priorTotalAttendees: prior.totalAttendees,
    priorSignedAttendees: prior.signedAttendees,
    currentTotal: current.total,
    currentDistinctTopics: current.topics.size,
    currentDistinctLeaders: current.leaders.size,
    currentDistinctJobs: current.jobs.size,
    currentTotalAttendees: current.totalAttendees,
    currentSignedAttendees: current.signedAttendees,
    totalDelta: current.total - prior.total,
  };
}
