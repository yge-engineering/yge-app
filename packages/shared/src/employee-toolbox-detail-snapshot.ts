// Employee-anchored per-job toolbox-talk detail snapshot.
//
// Plain English: for one employee (matched by employeeId, falling back
// to attendee name), return one row per job they attended a Cal/OSHA
// T8 §1509 tailgate safety meeting on: meetings attended, signed
// count, distinct topics, last attended date. Sorted by attended desc.
//
// Pure derivation. No persisted records.

import type { ToolboxTalk } from './toolbox-talk';

export interface EmployeeToolboxDetailRow {
  jobId: string;
  attended: number;
  signed: number;
  distinctTopics: number;
  lastAttendedDate: string | null;
}

export interface EmployeeToolboxDetailSnapshotResult {
  asOf: string;
  employeeId: string;
  rows: EmployeeToolboxDetailRow[];
}

export interface EmployeeToolboxDetailSnapshotInputs {
  employeeId: string;
  /** Optional name to match attendee rows that don't have an employeeId. */
  employeeName?: string;
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

export function buildEmployeeToolboxDetailSnapshot(
  inputs: EmployeeToolboxDetailSnapshotInputs,
): EmployeeToolboxDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const targetName = norm(inputs.employeeName);

  type Acc = {
    attended: number;
    signed: number;
    topics: Set<string>;
    lastDate: string | null;
  };
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
    if (!a) {
      a = { attended: 0, signed: 0, topics: new Set(), lastDate: null };
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const t of inputs.toolboxTalks) {
    if (!t.jobId) continue;
    if (t.heldOn > asOf) continue;
    let attendedThis = false;
    let signedThis = false;
    for (const att of t.attendees) {
      const idMatch = att.employeeId === inputs.employeeId;
      const nameMatch = targetName.length > 0 && norm(att.name) === targetName;
      if (idMatch || nameMatch) {
        attendedThis = true;
        if (att.signed) signedThis = true;
        break;
      }
    }
    if (!attendedThis) continue;
    const a = getAcc(t.jobId);
    a.attended += 1;
    if (signedThis) a.signed += 1;
    a.topics.add(norm(t.topic));
    if (a.lastDate == null || t.heldOn > a.lastDate) a.lastDate = t.heldOn;
  }

  const rows: EmployeeToolboxDetailRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
      attended: a.attended,
      signed: a.signed,
      distinctTopics: a.topics.size,
      lastAttendedDate: a.lastDate,
    }))
    .sort((a, b) => b.attended - a.attended || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    employeeId: inputs.employeeId,
    rows,
  };
}
