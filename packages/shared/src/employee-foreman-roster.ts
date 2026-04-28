// Employee → foreman roster.
//
// Plain English: every employee record carries an optional
// foremanId — who they report to in the field. This rolls the
// employee table up by that foremanId so we see, for each
// foreman, the crew currently assigned to them: count, mix by
// classification, mix by employment status (active, on leave,
// laid off, terminated).
//
// Per row: foremanId, foremanName, crewSize, activeCount,
// onLeaveCount, laidOffCount, terminatedCount, byClassification.
//
// Sort by crewSize desc.
//
// Different from dispatch-by-foreman (dispatch-side activity),
// foreman-throughput (DR-based crew throughput),
// foreman-scorecard (DR paperwork), and foreman-crew-turnover.
// This is the standing-roster view.
//
// Pure derivation. No persisted records.

import type { DirClassification, Employee } from './employee';

export interface EmployeeForemanRosterRow {
  foremanId: string;
  foremanName: string;
  crewSize: number;
  activeCount: number;
  onLeaveCount: number;
  laidOffCount: number;
  terminatedCount: number;
  byClassification: Partial<Record<DirClassification, number>>;
}

export interface EmployeeForemanRosterRollup {
  foremenConsidered: number;
  totalAssigned: number;
  unassigned: number;
}

export interface EmployeeForemanRosterInputs {
  employees: Employee[];
}

export function buildEmployeeForemanRoster(
  inputs: EmployeeForemanRosterInputs,
): {
  rollup: EmployeeForemanRosterRollup;
  rows: EmployeeForemanRosterRow[];
} {
  const empById = new Map<string, Employee>();
  for (const e of inputs.employees) empById.set(e.id, e);

  type Acc = {
    foremanId: string;
    crew: number;
    active: number;
    onLeave: number;
    laidOff: number;
    terminated: number;
    classes: Map<DirClassification, number>;
  };
  const accs = new Map<string, Acc>();
  let totalAssigned = 0;
  let unassigned = 0;

  for (const e of inputs.employees) {
    const fid = (e.foremanId ?? '').trim();
    if (!fid) {
      unassigned += 1;
      continue;
    }
    totalAssigned += 1;
    const acc = accs.get(fid) ?? {
      foremanId: fid,
      crew: 0,
      active: 0,
      onLeave: 0,
      laidOff: 0,
      terminated: 0,
      classes: new Map<DirClassification, number>(),
    };
    acc.crew += 1;
    if (e.status === 'ACTIVE') acc.active += 1;
    else if (e.status === 'ON_LEAVE') acc.onLeave += 1;
    else if (e.status === 'LAID_OFF') acc.laidOff += 1;
    else if (e.status === 'TERMINATED') acc.terminated += 1;
    acc.classes.set(e.classification, (acc.classes.get(e.classification) ?? 0) + 1);
    accs.set(fid, acc);
  }

  const rows: EmployeeForemanRosterRow[] = [];
  for (const acc of accs.values()) {
    const fore = empById.get(acc.foremanId);
    const name = fore
      ? (fore.displayName ?? `${fore.firstName} ${fore.lastName}`)
      : acc.foremanId;
    const obj: Partial<Record<DirClassification, number>> = {};
    for (const [k, v] of acc.classes.entries()) obj[k] = v;
    rows.push({
      foremanId: acc.foremanId,
      foremanName: name,
      crewSize: acc.crew,
      activeCount: acc.active,
      onLeaveCount: acc.onLeave,
      laidOffCount: acc.laidOff,
      terminatedCount: acc.terminated,
      byClassification: obj,
    });
  }

  rows.sort((a, b) => b.crewSize - a.crewSize);

  return {
    rollup: {
      foremenConsidered: rows.length,
      totalAssigned,
      unassigned,
    },
    rows,
  };
}
