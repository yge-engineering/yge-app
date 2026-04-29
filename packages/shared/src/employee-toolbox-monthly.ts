// Per-employee toolbox-talk attendance by month.
//
// Plain English: bucket toolbox-talk attendance by (employeeId,
// yyyy-mm). Useful for the per-employee monthly compliance
// review — "did Joe attend safety talks each month or did he
// miss them?"
//
// Per row: employeeId, month, talksAttended, signedCount,
// distinctTopics, distinctLeaders.
//
// Sort: employeeId asc, month asc.
//
// Different from employee-toolbox-rate (per-employee rate),
// toolbox-attendance-gap (gap detector), toolbox-by-leader (per
// leader).
//
// Pure derivation. No persisted records.

import type { ToolboxTalk } from './toolbox-talk';

export interface EmployeeToolboxMonthlyRow {
  employeeId: string;
  month: string;
  talksAttended: number;
  signedCount: number;
  distinctTopics: number;
  distinctLeaders: number;
}

export interface EmployeeToolboxMonthlyRollup {
  employeesConsidered: number;
  monthsConsidered: number;
  totalAttendances: number;
}

export interface EmployeeToolboxMonthlyInputs {
  toolboxTalks: ToolboxTalk[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildEmployeeToolboxMonthly(
  inputs: EmployeeToolboxMonthlyInputs,
): {
  rollup: EmployeeToolboxMonthlyRollup;
  rows: EmployeeToolboxMonthlyRow[];
} {
  type Acc = {
    employeeId: string;
    month: string;
    talks: number;
    signed: number;
    topics: Set<string>;
    leaders: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const empSet = new Set<string>();
  const monthSet = new Set<string>();
  let totalAttendances = 0;

  for (const t of inputs.toolboxTalks) {
    const month = t.heldOn.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    for (const a of t.attendees) {
      if (!a.employeeId) continue;
      const key = `${a.employeeId}|${month}`;
      const acc = accs.get(key) ?? {
        employeeId: a.employeeId,
        month,
        talks: 0,
        signed: 0,
        topics: new Set<string>(),
        leaders: new Set<string>(),
      };
      acc.talks += 1;
      if (a.signed) acc.signed += 1;
      acc.topics.add(t.topic.trim().toLowerCase());
      if (t.leaderName.trim()) acc.leaders.add(t.leaderName.trim().toLowerCase());
      accs.set(key, acc);
      empSet.add(a.employeeId);
      monthSet.add(month);
      totalAttendances += 1;
    }
  }

  const rows: EmployeeToolboxMonthlyRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      employeeId: acc.employeeId,
      month: acc.month,
      talksAttended: acc.talks,
      signedCount: acc.signed,
      distinctTopics: acc.topics.size,
      distinctLeaders: acc.leaders.size,
    });
  }

  rows.sort((a, b) => {
    if (a.employeeId !== b.employeeId) return a.employeeId.localeCompare(b.employeeId);
    return a.month.localeCompare(b.month);
  });

  return {
    rollup: {
      employeesConsidered: empSet.size,
      monthsConsidered: monthSet.size,
      totalAttendances,
    },
    rows,
  };
}
