// Per-employee toolbox attendance rate.
//
// Plain English: for each ACTIVE employee, how many toolbox
// talks did they attend (signed=true) divided by how many talks
// they had a chance to attend (talks held with status HELD or
// SUBMITTED in the window).
//
// Per row: attended, opportunities, attendanceRate, last
// attended date. Sort puts the lowest-attendance employees
// first so safety lead can target outreach.
//
// Different from toolbox-attendance-gap (gap finder, urgency
// tier) and toolbox-compliance (per-job cadence). This is the
// pure attendance percentage view.
//
// Pure derivation. No persisted records.

import type { Employee } from './employee';
import type { ToolboxTalk } from './toolbox-talk';

export interface EmployeeToolboxRateRow {
  employeeId: string;
  employeeName: string;
  attended: number;
  opportunities: number;
  attendanceRate: number;
  lastAttendedOn: string | null;
}

export interface EmployeeToolboxRateRollup {
  employeesConsidered: number;
  totalAttended: number;
  totalOpportunities: number;
  blendedAttendanceRate: number;
}

export interface EmployeeToolboxRateInputs {
  employees: Employee[];
  talks: ToolboxTalk[];
  fromDate?: string;
  toDate?: string;
  /** Default false — only ACTIVE employees scored. */
  includeInactive?: boolean;
}

export function buildEmployeeToolboxRate(
  inputs: EmployeeToolboxRateInputs,
): {
  rollup: EmployeeToolboxRateRollup;
  rows: EmployeeToolboxRateRow[];
} {
  const includeInactive = inputs.includeInactive === true;

  // Window-filter held talks once.
  const talks = inputs.talks.filter((t) => {
    if (t.status !== 'HELD' && t.status !== 'SUBMITTED') return false;
    if (inputs.fromDate && t.heldOn < inputs.fromDate) return false;
    if (inputs.toDate && t.heldOn > inputs.toDate) return false;
    return true;
  });
  const totalOpportunities = talks.length;

  const employees = inputs.employees.filter((e) =>
    includeInactive ? true : e.status === 'ACTIVE',
  );

  // Per-employee attendance.
  type Acc = { attended: number; lastAttendedOn: string };
  const accs = new Map<string, Acc>();
  for (const e of employees) accs.set(e.id, { attended: 0, lastAttendedOn: '' });
  for (const t of talks) {
    for (const a of t.attendees) {
      if (!a.employeeId) continue;
      if (!a.signed) continue;
      const acc = accs.get(a.employeeId);
      if (!acc) continue;
      acc.attended += 1;
      if (t.heldOn > acc.lastAttendedOn) acc.lastAttendedOn = t.heldOn;
    }
  }

  let totalAttended = 0;

  const rows: EmployeeToolboxRateRow[] = employees.map((e) => {
    const acc = accs.get(e.id) ?? { attended: 0, lastAttendedOn: '' };
    const rate = totalOpportunities === 0
      ? 0
      : Math.round((acc.attended / totalOpportunities) * 10_000) / 10_000;
    totalAttended += acc.attended;
    return {
      employeeId: e.id,
      employeeName: nameOf(e),
      attended: acc.attended,
      opportunities: totalOpportunities,
      attendanceRate: rate,
      lastAttendedOn: acc.lastAttendedOn || null,
    };
  });

  // Sort: lowest attendance rate first.
  rows.sort((a, b) => {
    if (a.attendanceRate !== b.attendanceRate) return a.attendanceRate - b.attendanceRate;
    return a.employeeName.localeCompare(b.employeeName);
  });

  const blended = totalOpportunities * rows.length === 0
    ? 0
    : Math.round((totalAttended / Math.max(1, totalOpportunities * rows.length)) * 10_000) / 10_000;

  return {
    rollup: {
      employeesConsidered: rows.length,
      totalAttended,
      totalOpportunities,
      blendedAttendanceRate: blended,
    },
    rows,
  };
}

function nameOf(e: Employee): string {
  if (e.displayName && e.displayName.trim().length > 0) {
    return `${e.displayName} ${e.lastName}`;
  }
  return `${e.firstName} ${e.lastName}`;
}
