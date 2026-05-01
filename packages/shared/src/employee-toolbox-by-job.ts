// Per (employee, job) toolbox-talk attendance.
//
// Plain English: per (employeeId, toolbox-talk's jobId), count
// attendances. Useful for the "did Joe attend the safety
// briefings on Sulphur Springs?" check.
//
// Per row: employeeId, jobId, talksAttended, signedCount,
// distinctTopics, lastHeldOn.
//
// Sort: employeeId asc, talksAttended desc within employee.
//
// Different from employee-toolbox-monthly (per (employee,
// month)), employee-toolbox-rate (per-employee rate), job-
// toolbox-summary (per-job rollup).
//
// Pure derivation. No persisted records.

import type { ToolboxTalk } from './toolbox-talk';

export interface EmployeeToolboxByJobRow {
  employeeId: string;
  jobId: string;
  talksAttended: number;
  signedCount: number;
  distinctTopics: number;
  lastHeldOn: string | null;
}

export interface EmployeeToolboxByJobRollup {
  employeesConsidered: number;
  jobsConsidered: number;
  totalAttendances: number;
}

export interface EmployeeToolboxByJobInputs {
  toolboxTalks: ToolboxTalk[];
  /** Optional yyyy-mm-dd window applied to heldOn. */
  fromDate?: string;
  toDate?: string;
}

export function buildEmployeeToolboxByJob(
  inputs: EmployeeToolboxByJobInputs,
): {
  rollup: EmployeeToolboxByJobRollup;
  rows: EmployeeToolboxByJobRow[];
} {
  type Acc = {
    employeeId: string;
    jobId: string;
    attended: number;
    signed: number;
    topics: Set<string>;
    lastHeldOn: string | null;
  };
  const accs = new Map<string, Acc>();
  const empSet = new Set<string>();
  const jobSet = new Set<string>();
  let totalAttendances = 0;

  for (const t of inputs.toolboxTalks) {
    if (inputs.fromDate && t.heldOn < inputs.fromDate) continue;
    if (inputs.toDate && t.heldOn > inputs.toDate) continue;
    if (!t.jobId) continue;
    for (const a of t.attendees) {
      if (!a.employeeId) continue;
      const key = `${a.employeeId}|${t.jobId}`;
      const acc = accs.get(key) ?? {
        employeeId: a.employeeId,
        jobId: t.jobId,
        attended: 0,
        signed: 0,
        topics: new Set<string>(),
        lastHeldOn: null,
      };
      acc.attended += 1;
      if (a.signed) acc.signed += 1;
      acc.topics.add(t.topic.trim().toLowerCase());
      if (!acc.lastHeldOn || t.heldOn > acc.lastHeldOn) acc.lastHeldOn = t.heldOn;
      accs.set(key, acc);
      empSet.add(a.employeeId);
      jobSet.add(t.jobId);
      totalAttendances += 1;
    }
  }

  const rows: EmployeeToolboxByJobRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      employeeId: acc.employeeId,
      jobId: acc.jobId,
      talksAttended: acc.attended,
      signedCount: acc.signed,
      distinctTopics: acc.topics.size,
      lastHeldOn: acc.lastHeldOn,
    });
  }

  rows.sort((a, b) => {
    if (a.employeeId !== b.employeeId) return a.employeeId.localeCompare(b.employeeId);
    return b.talksAttended - a.talksAttended;
  });

  return {
    rollup: {
      employeesConsidered: empSet.size,
      jobsConsidered: jobSet.size,
      totalAttendances,
    },
    rows,
  };
}
