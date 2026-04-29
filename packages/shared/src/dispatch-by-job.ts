// Per-job dispatch portfolio summary.
//
// Plain English: sister to job-dispatch-summary, but adds the
// per-job avg crew size, avg equipment lines, and total crew
// person-days. Different angle on the same data.
//
// Per row: jobId, dispatches, distinctDates, distinctForemen,
// distinctEmployees, avgCrewSize, avgEquipmentLines,
// totalCrewPersonDays, totalEquipmentLines, lastDispatchDate.
//
// Sort by totalCrewPersonDays desc.
//
// Different from job-dispatch-summary (count + distinct, no
// averages), dispatch-by-foreman (per foreman),
// dispatch-by-job-monthly (per (job, month)).
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';

export interface DispatchByJobRow {
  jobId: string;
  dispatches: number;
  distinctDates: number;
  distinctForemen: number;
  distinctEmployees: number;
  avgCrewSize: number;
  avgEquipmentLines: number;
  totalCrewPersonDays: number;
  totalEquipmentLines: number;
  lastDispatchDate: string | null;
}

export interface DispatchByJobRollup {
  jobsConsidered: number;
  totalDispatches: number;
  totalCrewPersonDays: number;
}

export interface DispatchByJobInputs {
  dispatches: Dispatch[];
  /** Optional yyyy-mm-dd window applied to scheduledFor. */
  fromDate?: string;
  toDate?: string;
}

export function buildDispatchByJob(
  inputs: DispatchByJobInputs,
): {
  rollup: DispatchByJobRollup;
  rows: DispatchByJobRow[];
} {
  type Acc = {
    jobId: string;
    dispatches: number;
    dates: Set<string>;
    foremen: Set<string>;
    employees: Set<string>;
    crew: number;
    equip: number;
    lastDate: string | null;
  };
  const accs = new Map<string, Acc>();
  let totalDispatches = 0;

  for (const d of inputs.dispatches) {
    if (d.status !== 'POSTED' && d.status !== 'COMPLETED') continue;
    if (inputs.fromDate && d.scheduledFor < inputs.fromDate) continue;
    if (inputs.toDate && d.scheduledFor > inputs.toDate) continue;
    totalDispatches += 1;
    const acc = accs.get(d.jobId) ?? {
      jobId: d.jobId,
      dispatches: 0,
      dates: new Set<string>(),
      foremen: new Set<string>(),
      employees: new Set<string>(),
      crew: 0,
      equip: 0,
      lastDate: null,
    };
    acc.dispatches += 1;
    acc.dates.add(d.scheduledFor);
    if (d.foremanName.trim()) acc.foremen.add(d.foremanName.trim().toLowerCase());
    for (const c of d.crew) {
      const key = c.employeeId ?? `name:${c.name.trim().toLowerCase()}`;
      acc.employees.add(key);
    }
    acc.crew += d.crew.length;
    acc.equip += d.equipment.length;
    if (!acc.lastDate || d.scheduledFor > acc.lastDate) acc.lastDate = d.scheduledFor;
    accs.set(d.jobId, acc);
  }

  const rows: DispatchByJobRow[] = [];
  let totalCrewPersonDays = 0;
  for (const acc of accs.values()) {
    const avgCrew = acc.dispatches === 0
      ? 0
      : Math.round((acc.crew / acc.dispatches) * 100) / 100;
    const avgEq = acc.dispatches === 0
      ? 0
      : Math.round((acc.equip / acc.dispatches) * 100) / 100;
    rows.push({
      jobId: acc.jobId,
      dispatches: acc.dispatches,
      distinctDates: acc.dates.size,
      distinctForemen: acc.foremen.size,
      distinctEmployees: acc.employees.size,
      avgCrewSize: avgCrew,
      avgEquipmentLines: avgEq,
      totalCrewPersonDays: acc.crew,
      totalEquipmentLines: acc.equip,
      lastDispatchDate: acc.lastDate,
    });
    totalCrewPersonDays += acc.crew;
  }

  rows.sort((a, b) => b.totalCrewPersonDays - a.totalCrewPersonDays);

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalDispatches,
      totalCrewPersonDays,
    },
    rows,
  };
}
