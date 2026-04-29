// Incidents by day of week.
//
// Plain English: across the OSHA 300 log, count incidents by
// UTC day of week. Spotting "Monday morning is a struck-by-
// vehicle hot spot" is the kind of pattern that drives the
// targeted toolbox talk.
//
// Per row: dayOfWeek, label, count, totalDaysAway,
// distinctEmployees, distinctJobs.
//
// Sort: Mon-first.
//
// Different from incident-monthly-trend (per-month volume),
// incident-by-classification (per kind), incident-monthly-by-
// job (per (job, month)).
//
// Pure derivation. No persisted records.

import type { Incident } from './incident';

export interface IncidentByDayOfWeekRow {
  dayOfWeek: number;
  label: string;
  count: number;
  totalDaysAway: number;
  distinctEmployees: number;
  distinctJobs: number;
}

export interface IncidentByDayOfWeekRollup {
  daysConsidered: number;
  totalIncidents: number;
}

export interface IncidentByDayOfWeekInputs {
  incidents: Incident[];
  /** Optional yyyy-mm-dd window applied to incidentDate. */
  fromDate?: string;
  toDate?: string;
}

const LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SORT_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function buildIncidentByDayOfWeek(
  inputs: IncidentByDayOfWeekInputs,
): {
  rollup: IncidentByDayOfWeekRollup;
  rows: IncidentByDayOfWeekRow[];
} {
  type Acc = {
    count: number;
    daysAway: number;
    employees: Set<string>;
    jobs: Set<string>;
  };
  const accs = new Map<number, Acc>();
  let totalIncidents = 0;

  for (const inc of inputs.incidents) {
    if (inputs.fromDate && inc.incidentDate < inputs.fromDate) continue;
    if (inputs.toDate && inc.incidentDate > inputs.toDate) continue;
    const dow = dayOfWeekUtc(inc.incidentDate);
    if (dow < 0) continue;
    totalIncidents += 1;
    const acc = accs.get(dow) ?? {
      count: 0,
      daysAway: 0,
      employees: new Set<string>(),
      jobs: new Set<string>(),
    };
    acc.count += 1;
    acc.daysAway += inc.daysAway;
    if (inc.employeeId) acc.employees.add(inc.employeeId);
    else if (inc.employeeName) acc.employees.add(`name:${inc.employeeName.toLowerCase()}`);
    if (inc.jobId) acc.jobs.add(inc.jobId);
    accs.set(dow, acc);
  }

  const rows: IncidentByDayOfWeekRow[] = [];
  for (const dow of SORT_ORDER) {
    const acc = accs.get(dow);
    if (!acc) continue;
    rows.push({
      dayOfWeek: dow,
      label: LABELS[dow] ?? '',
      count: acc.count,
      totalDaysAway: acc.daysAway,
      distinctEmployees: acc.employees.size,
      distinctJobs: acc.jobs.size,
    });
  }

  return {
    rollup: {
      daysConsidered: rows.length,
      totalIncidents,
    },
    rows,
  };
}

function dayOfWeekUtc(ymd: string): number {
  const t = Date.parse(ymd + 'T00:00:00Z');
  if (Number.isNaN(t)) return -1;
  return new Date(t).getUTCDay();
}
