// Per-job dispatch summary.
//
// Plain English: for any one job, the at-a-glance "what's been
// running here" view: how many dispatches, how many distinct
// days, which foremen, how many distinct crew members, how many
// equipment lines, when's the most recent dispatch.
//
// Per row: jobId, dispatches, distinctDates, distinctForemen,
// distinctEmployees, equipmentLines, lastDispatchDate.
//
// Drafts are skipped; only POSTED + COMPLETED dispatches count
// (because draft dispatches haven't gone out to the foremen and
// might still be reshuffled).
//
// Sort by dispatches desc.
//
// Different from job-dispatch-coverage (windowed coverage flag),
// dispatch-utilization (per-employee show-up rate), and
// equipment-dispatch-days (per-equipment days).
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';

export interface JobDispatchSummaryRow {
  jobId: string;
  dispatches: number;
  distinctDates: number;
  distinctForemen: number;
  distinctEmployees: number;
  equipmentLines: number;
  lastDispatchDate: string | null;
}

export interface JobDispatchSummaryRollup {
  jobsConsidered: number;
  totalDispatches: number;
}

export interface JobDispatchSummaryInputs {
  dispatches: Dispatch[];
  /** Optional yyyy-mm-dd window applied to scheduledFor. */
  fromDate?: string;
  toDate?: string;
}

export function buildJobDispatchSummary(
  inputs: JobDispatchSummaryInputs,
): {
  rollup: JobDispatchSummaryRollup;
  rows: JobDispatchSummaryRow[];
} {
  type Acc = {
    jobId: string;
    dispatches: number;
    dates: Set<string>;
    foremen: Set<string>;
    employees: Set<string>;
    equipmentLines: number;
    lastDate: string | null;
  };
  const accs = new Map<string, Acc>();
  let total = 0;

  for (const d of inputs.dispatches) {
    if (d.status !== 'POSTED' && d.status !== 'COMPLETED') continue;
    if (inputs.fromDate && d.scheduledFor < inputs.fromDate) continue;
    if (inputs.toDate && d.scheduledFor > inputs.toDate) continue;
    total += 1;
    const acc = accs.get(d.jobId) ?? {
      jobId: d.jobId,
      dispatches: 0,
      dates: new Set<string>(),
      foremen: new Set<string>(),
      employees: new Set<string>(),
      equipmentLines: 0,
      lastDate: null,
    };
    acc.dispatches += 1;
    acc.dates.add(d.scheduledFor);
    if (d.foremanName.trim()) acc.foremen.add(d.foremanName.trim().toLowerCase());
    for (const c of d.crew) {
      const key = c.employeeId ?? `name:${c.name.trim().toLowerCase()}`;
      acc.employees.add(key);
    }
    acc.equipmentLines += d.equipment.length;
    if (!acc.lastDate || d.scheduledFor > acc.lastDate) acc.lastDate = d.scheduledFor;
    accs.set(d.jobId, acc);
  }

  const rows: JobDispatchSummaryRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      jobId: acc.jobId,
      dispatches: acc.dispatches,
      distinctDates: acc.dates.size,
      distinctForemen: acc.foremen.size,
      distinctEmployees: acc.employees.size,
      equipmentLines: acc.equipmentLines,
      lastDispatchDate: acc.lastDate,
    });
  }

  rows.sort((a, b) => b.dispatches - a.dispatches);

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalDispatches: total,
    },
    rows,
  };
}
