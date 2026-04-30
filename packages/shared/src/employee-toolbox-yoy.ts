// Employee-anchored toolbox-talk year-over-year.
//
// Plain English: for one employee, collapse two years of
// toolbox-talk attendance/leadership into a comparison: total
// attended, signed, led, distinct topics + jobs, plus deltas.
//
// Pure derivation. No persisted records.

import type { ToolboxTalk } from './toolbox-talk';

export interface EmployeeToolboxYoyResult {
  employeeId: string;
  employeeName: string;
  priorYear: number;
  currentYear: number;
  priorAttended: number;
  priorSigned: number;
  priorLed: number;
  priorDistinctTopics: number;
  priorDistinctJobs: number;
  currentAttended: number;
  currentSigned: number;
  currentLed: number;
  currentDistinctTopics: number;
  currentDistinctJobs: number;
  attendedDelta: number;
}

export interface EmployeeToolboxYoyInputs {
  employeeId: string;
  employeeName: string;
  toolboxTalks: ToolboxTalk[];
  currentYear: number;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildEmployeeToolboxYoy(
  inputs: EmployeeToolboxYoyInputs,
): EmployeeToolboxYoyResult {
  const priorYear = inputs.currentYear - 1;
  const targetName = norm(inputs.employeeName);

  type Bucket = {
    attended: number;
    signed: number;
    led: number;
    topics: Set<string>;
    jobs: Set<string>;
  };
  function emptyBucket(): Bucket {
    return { attended: 0, signed: 0, led: 0, topics: new Set(), jobs: new Set() };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const t of inputs.toolboxTalks) {
    const year = Number(t.heldOn.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    const led = norm(t.leaderName) === targetName;
    let attended = false;
    let signed = false;
    for (const a of t.attendees ?? []) {
      const matchById = a.employeeId === inputs.employeeId;
      const matchByName = !a.employeeId && norm(a.name) === targetName;
      if (matchById || matchByName) {
        attended = true;
        if (a.signed) signed = true;
        break;
      }
    }
    if (led) b.led += 1;
    if (attended || led) {
      b.attended += 1;
      if (signed) b.signed += 1;
      if (t.topic) b.topics.add(t.topic.trim().toLowerCase());
      if (t.jobId) b.jobs.add(t.jobId);
    }
  }

  return {
    employeeId: inputs.employeeId,
    employeeName: inputs.employeeName,
    priorYear,
    currentYear: inputs.currentYear,
    priorAttended: prior.attended,
    priorSigned: prior.signed,
    priorLed: prior.led,
    priorDistinctTopics: prior.topics.size,
    priorDistinctJobs: prior.jobs.size,
    currentAttended: current.attended,
    currentSigned: current.signed,
    currentLed: current.led,
    currentDistinctTopics: current.topics.size,
    currentDistinctJobs: current.jobs.size,
    attendedDelta: current.attended - prior.attended,
  };
}
