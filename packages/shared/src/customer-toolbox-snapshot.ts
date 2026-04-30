// Customer-anchored toolbox-talk snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// as-of today, count toolbox talks across all their jobs,
// distinct topics + leaders, attendees signed, last talk date.
// Drives the right-now per-customer safety-talk overview.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { ToolboxTalk } from './toolbox-talk';

export interface CustomerToolboxSnapshotResult {
  asOf: string;
  customerName: string;
  totalTalks: number;
  ytdTalks: number;
  distinctTopics: number;
  distinctLeaders: number;
  totalAttendees: number;
  signedAttendees: number;
  distinctJobs: number;
  lastTalkDate: string | null;
}

export interface CustomerToolboxSnapshotInputs {
  customerName: string;
  toolboxTalks: ToolboxTalk[];
  jobs: Job[];
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

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildCustomerToolboxSnapshot(
  inputs: CustomerToolboxSnapshotInputs,
): CustomerToolboxSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const logYear = inputs.logYear ?? Number(asOf.slice(0, 4));
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  const topics = new Set<string>();
  const leaders = new Set<string>();
  const jobs = new Set<string>();
  let totalTalks = 0;
  let ytdTalks = 0;
  let totalAttendees = 0;
  let signedAttendees = 0;
  let lastTalkDate: string | null = null;

  for (const t of inputs.toolboxTalks) {
    if (!t.jobId || !customerJobs.has(t.jobId)) continue;
    if (t.heldOn > asOf) continue;
    totalTalks += 1;
    if (Number(t.heldOn.slice(0, 4)) === logYear) ytdTalks += 1;
    if (t.topic) topics.add(t.topic.trim().toLowerCase());
    if (t.leaderName) leaders.add(t.leaderName.trim().toLowerCase());
    for (const a of t.attendees ?? []) {
      totalAttendees += 1;
      if (a.signed) signedAttendees += 1;
    }
    jobs.add(t.jobId);
    if (lastTalkDate == null || t.heldOn > lastTalkDate) lastTalkDate = t.heldOn;
  }

  return {
    asOf,
    customerName: inputs.customerName,
    totalTalks,
    ytdTalks,
    distinctTopics: topics.size,
    distinctLeaders: leaders.size,
    totalAttendees,
    signedAttendees,
    distinctJobs: jobs.size,
    lastTalkDate,
  };
}
