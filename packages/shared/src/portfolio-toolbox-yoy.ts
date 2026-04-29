// Portfolio toolbox-talk year-over-year.
//
// Plain English: collapse two years of toolbox talks into a
// single comparison. Counts talks, distinct topics + leaders,
// total + signed attendees, distinct jobs, plus deltas.
// Sized for the IIPP coordinator's annual safety report and
// the bonding agent's compliance review.
//
// Different from portfolio-toolbox-monthly (per month) and
// toolbox-compliance (point-in-time rate).
//
// Pure derivation. No persisted records.

import type { ToolboxTalk } from './toolbox-talk';

export interface PortfolioToolboxYoyResult {
  priorYear: number;
  currentYear: number;
  priorTalks: number;
  priorDistinctTopics: number;
  priorDistinctLeaders: number;
  priorTotalAttendees: number;
  priorSignedAttendees: number;
  priorDistinctJobs: number;
  currentTalks: number;
  currentDistinctTopics: number;
  currentDistinctLeaders: number;
  currentTotalAttendees: number;
  currentSignedAttendees: number;
  currentDistinctJobs: number;
  talksDelta: number;
  totalAttendeesDelta: number;
  signedAttendeesDelta: number;
}

export interface PortfolioToolboxYoyInputs {
  toolboxTalks: ToolboxTalk[];
  currentYear: number;
}

export function buildPortfolioToolboxYoy(
  inputs: PortfolioToolboxYoyInputs,
): PortfolioToolboxYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    talks: number;
    topics: Set<string>;
    leaders: Set<string>;
    attendees: number;
    signed: number;
    jobs: Set<string>;
  };
  function emptyBucket(): Bucket {
    return {
      talks: 0,
      topics: new Set(),
      leaders: new Set(),
      attendees: 0,
      signed: 0,
      jobs: new Set(),
    };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const t of inputs.toolboxTalks) {
    const year = Number(t.heldOn.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.talks += 1;
    b.topics.add(t.topic.toLowerCase().trim());
    b.leaders.add(t.leaderName);
    const attendees = t.attendees ?? [];
    b.attendees += attendees.length;
    for (const at of attendees) if (at.signed) b.signed += 1;
    if (t.jobId) b.jobs.add(t.jobId);
  }

  return {
    priorYear,
    currentYear: inputs.currentYear,
    priorTalks: prior.talks,
    priorDistinctTopics: prior.topics.size,
    priorDistinctLeaders: prior.leaders.size,
    priorTotalAttendees: prior.attendees,
    priorSignedAttendees: prior.signed,
    priorDistinctJobs: prior.jobs.size,
    currentTalks: current.talks,
    currentDistinctTopics: current.topics.size,
    currentDistinctLeaders: current.leaders.size,
    currentTotalAttendees: current.attendees,
    currentSignedAttendees: current.signed,
    currentDistinctJobs: current.jobs.size,
    talksDelta: current.talks - prior.talks,
    totalAttendeesDelta: current.attendees - prior.attendees,
    signedAttendeesDelta: current.signed - prior.signed,
  };
}
