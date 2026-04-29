// Portfolio dispatch activity by month with status mix.
//
// Plain English: per yyyy-mm of scheduledFor, count dispatches
// with status mix (DRAFT / POSTED / COMPLETED / CANCELLED),
// crew lines + equipment lines, distinct foremen + jobs.
// Drives the field manager's monthly throughput.
//
// Per row: month, total, draft, posted, completed, cancelled,
// totalCrewLines, totalEquipmentLines, distinctForemen,
// distinctJobs.
//
// Sort: month asc.
//
// Different from dispatch-by-month-by-status (no crew/equipment
// counts), dispatch-monthly-volume (crew + equipment, no
// status mix), customer-dispatch-monthly (per customer).
//
// Pure derivation. No persisted records.

import type { Dispatch, DispatchStatus } from './dispatch';

export interface PortfolioDispatchMonthlyRow {
  month: string;
  total: number;
  draft: number;
  posted: number;
  completed: number;
  cancelled: number;
  totalCrewLines: number;
  totalEquipmentLines: number;
  distinctForemen: number;
  distinctJobs: number;
}

export interface PortfolioDispatchMonthlyRollup {
  monthsConsidered: number;
  totalDispatches: number;
  totalCrewLines: number;
  totalEquipmentLines: number;
}

export interface PortfolioDispatchMonthlyInputs {
  dispatches: Dispatch[];
  fromMonth?: string;
  toMonth?: string;
}

export function buildPortfolioDispatchMonthly(
  inputs: PortfolioDispatchMonthlyInputs,
): {
  rollup: PortfolioDispatchMonthlyRollup;
  rows: PortfolioDispatchMonthlyRow[];
} {
  type Acc = {
    month: string;
    total: number;
    byStatus: Record<DispatchStatus, number>;
    crewLines: number;
    equipmentLines: number;
    foremen: Set<string>;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();

  let totalDispatches = 0;
  let totalCrewLines = 0;
  let totalEquipmentLines = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const d of inputs.dispatches) {
    const month = d.scheduledFor.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    let a = accs.get(month);
    if (!a) {
      a = {
        month,
        total: 0,
        byStatus: { DRAFT: 0, POSTED: 0, COMPLETED: 0, CANCELLED: 0 },
        crewLines: 0,
        equipmentLines: 0,
        foremen: new Set(),
        jobs: new Set(),
      };
      accs.set(month, a);
    }
    a.total += 1;
    const st: DispatchStatus = d.status ?? 'DRAFT';
    a.byStatus[st] += 1;
    a.crewLines += (d.crew ?? []).length;
    a.equipmentLines += (d.equipment ?? []).length;
    if (d.foremanName) a.foremen.add(d.foremanName);
    a.jobs.add(d.jobId);

    totalDispatches += 1;
    totalCrewLines += (d.crew ?? []).length;
    totalEquipmentLines += (d.equipment ?? []).length;
  }

  const rows: PortfolioDispatchMonthlyRow[] = [...accs.values()]
    .map((a) => ({
      month: a.month,
      total: a.total,
      draft: a.byStatus.DRAFT,
      posted: a.byStatus.POSTED,
      completed: a.byStatus.COMPLETED,
      cancelled: a.byStatus.CANCELLED,
      totalCrewLines: a.crewLines,
      totalEquipmentLines: a.equipmentLines,
      distinctForemen: a.foremen.size,
      distinctJobs: a.jobs.size,
    }))
    .sort((x, y) => x.month.localeCompare(y.month));

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalDispatches,
      totalCrewLines,
      totalEquipmentLines,
    },
    rows,
  };
}
