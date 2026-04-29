// Per (employee, month) dispatch days.
//
// Plain English: bucket POSTED + COMPLETED dispatch crew lines
// by (employeeId, yyyy-mm). Long-format. Useful for "Joe was
// dispatched 22 days in April" type checks against time-card
// hours.
//
// Per row: employeeId, month, dispatchDays (distinct dates the
// employee appeared on a dispatch), dispatches (line count),
// distinctJobs.
//
// Sort: employeeId asc, month asc.
//
// Different from dispatch-utilization (per-employee show-up
// rate), employee-dispatch-streak (consecutive days). This is
// the per (employee, month) view.
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';

export interface DispatchCrewMonthlyRow {
  employeeId: string;
  month: string;
  dispatchDays: number;
  dispatches: number;
  distinctJobs: number;
}

export interface DispatchCrewMonthlyRollup {
  employeesConsidered: number;
  monthsConsidered: number;
  totalDispatches: number;
}

export interface DispatchCrewMonthlyInputs {
  dispatches: Dispatch[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildDispatchCrewMonthly(
  inputs: DispatchCrewMonthlyInputs,
): {
  rollup: DispatchCrewMonthlyRollup;
  rows: DispatchCrewMonthlyRow[];
} {
  type Acc = {
    employeeId: string;
    month: string;
    dates: Set<string>;
    lines: number;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const empSet = new Set<string>();
  const monthSet = new Set<string>();
  let totalDispatches = 0;

  for (const d of inputs.dispatches) {
    if (d.status !== 'POSTED' && d.status !== 'COMPLETED') continue;
    const month = d.scheduledFor.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    for (const c of d.crew) {
      const employeeId = c.employeeId ?? `name:${c.name.trim().toLowerCase()}`;
      if (!employeeId) continue;
      const key = `${employeeId}|${month}`;
      const acc = accs.get(key) ?? {
        employeeId,
        month,
        dates: new Set<string>(),
        lines: 0,
        jobs: new Set<string>(),
      };
      acc.dates.add(d.scheduledFor);
      acc.lines += 1;
      acc.jobs.add(d.jobId);
      accs.set(key, acc);
      empSet.add(employeeId);
      monthSet.add(month);
      totalDispatches += 1;
    }
  }

  const rows: DispatchCrewMonthlyRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      employeeId: acc.employeeId,
      month: acc.month,
      dispatchDays: acc.dates.size,
      dispatches: acc.lines,
      distinctJobs: acc.jobs.size,
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
      totalDispatches,
    },
    rows,
  };
}
