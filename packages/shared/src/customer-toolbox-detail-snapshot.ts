// Customer-anchored per-job toolbox-talk detail snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// return one row per job: talks held, distinct topics, total +
// signed attendees, last talk date. Sorted by talks descending.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { ToolboxTalk } from './toolbox-talk';

export interface CustomerToolboxDetailRow {
  jobId: string;
  talks: number;
  distinctTopics: number;
  totalAttendees: number;
  signedAttendees: number;
  lastTalkDate: string | null;
}

export interface CustomerToolboxDetailSnapshotResult {
  asOf: string;
  customerName: string;
  rows: CustomerToolboxDetailRow[];
}

export interface CustomerToolboxDetailSnapshotInputs {
  customerName: string;
  jobs: Job[];
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

export function buildCustomerToolboxDetailSnapshot(
  inputs: CustomerToolboxDetailSnapshotInputs,
): CustomerToolboxDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Acc = {
    talks: number;
    topics: Set<string>;
    totalAttendees: number;
    signedAttendees: number;
    lastDate: string | null;
  };
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
    if (!a) {
      a = { talks: 0, topics: new Set(), totalAttendees: 0, signedAttendees: 0, lastDate: null };
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const t of inputs.toolboxTalks) {
    if (!t.jobId || !customerJobs.has(t.jobId)) continue;
    if (t.heldOn > asOf) continue;
    const a = getAcc(t.jobId);
    a.talks += 1;
    if (t.topic) a.topics.add(t.topic.trim().toLowerCase());
    for (const attendee of t.attendees ?? []) {
      a.totalAttendees += 1;
      if (attendee.signed) a.signedAttendees += 1;
    }
    if (a.lastDate == null || t.heldOn > a.lastDate) a.lastDate = t.heldOn;
  }

  const rows: CustomerToolboxDetailRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
      talks: a.talks,
      distinctTopics: a.topics.size,
      totalAttendees: a.totalAttendees,
      signedAttendees: a.signedAttendees,
      lastTalkDate: a.lastDate,
    }))
    .sort((a, b) => b.talks - a.talks || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    customerName: inputs.customerName,
    rows,
  };
}
