// Employee-anchored toolbox-talk snapshot.
//
// Plain English: for one employee, as-of today, count toolbox
// talks they attended (signed or unsigned) + count they led
// (matched by name), distinct topics + jobs, last attended
// date.
//
// Pure derivation. No persisted records.

import type { ToolboxTalk } from './toolbox-talk';

export interface EmployeeToolboxSnapshotResult {
  asOf: string;
  employeeId: string;
  employeeName: string;
  attendedTalks: number;
  signedTalks: number;
  ledTalks: number;
  distinctTopics: number;
  distinctJobs: number;
  lastAttendedDate: string | null;
}

export interface EmployeeToolboxSnapshotInputs {
  employeeId: string;
  /** Printed name to match against attendee.name (when employeeId not
   *  set on the attendee row) and against leaderName. */
  employeeName: string;
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

export function buildEmployeeToolboxSnapshot(
  inputs: EmployeeToolboxSnapshotInputs,
): EmployeeToolboxSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const targetName = norm(inputs.employeeName);

  const topics = new Set<string>();
  const jobs = new Set<string>();
  let attendedTalks = 0;
  let signedTalks = 0;
  let ledTalks = 0;
  let lastAttendedDate: string | null = null;

  for (const t of inputs.toolboxTalks) {
    if (t.heldOn > asOf) continue;
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
    if (led) ledTalks += 1;
    if (attended || led) {
      attendedTalks += 1;
      if (signed) signedTalks += 1;
      if (t.topic) topics.add(t.topic.trim().toLowerCase());
      if (t.jobId) jobs.add(t.jobId);
      if (lastAttendedDate == null || t.heldOn > lastAttendedDate) lastAttendedDate = t.heldOn;
    }
  }

  return {
    asOf,
    employeeId: inputs.employeeId,
    employeeName: inputs.employeeName,
    attendedTalks,
    signedTalks,
    ledTalks,
    distinctTopics: topics.size,
    distinctJobs: jobs.size,
    lastAttendedDate,
  };
}
