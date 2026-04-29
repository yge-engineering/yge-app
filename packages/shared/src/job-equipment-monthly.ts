// Per (job, month) equipment dispatch days.
//
// Plain English: bucket dispatch equipment lines by (jobId,
// yyyy-mm) — distinct days each piece of iron was on this job
// each month. Useful for monthly equipment-rental rebill against
// internal cost rates.
//
// Per row: jobId, month, equipmentLines, distinctDates,
// distinctUnits.
//
// Sort: jobId asc, month asc.
//
// Different from job-equipment-days (per-job lifetime),
// dispatch-equipment-monthly (portfolio per category per month),
// dispatch-by-job-monthly (per-job dispatch volume).
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';

export interface JobEquipmentMonthlyRow {
  jobId: string;
  month: string;
  equipmentLines: number;
  distinctDates: number;
  distinctUnits: number;
}

export interface JobEquipmentMonthlyRollup {
  jobsConsidered: number;
  monthsConsidered: number;
  totalLines: number;
}

export interface JobEquipmentMonthlyInputs {
  dispatches: Dispatch[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildJobEquipmentMonthly(
  inputs: JobEquipmentMonthlyInputs,
): {
  rollup: JobEquipmentMonthlyRollup;
  rows: JobEquipmentMonthlyRow[];
} {
  type Acc = {
    jobId: string;
    month: string;
    lines: number;
    dates: Set<string>;
    units: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const jobSet = new Set<string>();
  const monthSet = new Set<string>();
  let totalLines = 0;

  for (const d of inputs.dispatches) {
    if (d.status !== 'POSTED' && d.status !== 'COMPLETED') continue;
    const month = d.scheduledFor.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    if (d.equipment.length === 0) continue;
    const key = `${d.jobId}|${month}`;
    const acc = accs.get(key) ?? {
      jobId: d.jobId,
      month,
      lines: 0,
      dates: new Set<string>(),
      units: new Set<string>(),
    };
    for (const e of d.equipment) {
      acc.lines += 1;
      const unitKey = e.equipmentId ?? `name:${e.name.trim().toLowerCase()}`;
      acc.units.add(unitKey);
      totalLines += 1;
    }
    acc.dates.add(d.scheduledFor);
    accs.set(key, acc);
    jobSet.add(d.jobId);
    monthSet.add(month);
  }

  const rows: JobEquipmentMonthlyRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      jobId: acc.jobId,
      month: acc.month,
      equipmentLines: acc.lines,
      distinctDates: acc.dates.size,
      distinctUnits: acc.units.size,
    });
  }

  rows.sort((a, b) => {
    if (a.jobId !== b.jobId) return a.jobId.localeCompare(b.jobId);
    return a.month.localeCompare(b.month);
  });

  return {
    rollup: {
      jobsConsidered: jobSet.size,
      monthsConsidered: monthSet.size,
      totalLines,
    },
    rows,
  };
}
