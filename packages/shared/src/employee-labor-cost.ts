// Per-employee labor cost rollup.
//
// Plain English: each employee has a DIR classification (LABORER,
// OPERATING_ENGINEER_GROUP_2, CARPENTER, etc.) that drives the
// hourly rate for the kind of work they do. This module walks
// time cards, sums hours per employee, and costs them out at a
// caller-supplied per-classification rate.
//
// Drives:
//   - payroll prep (what's the gross labor cost this week?)
//   - per-job labor allocation (the per-employee row carries
//     hours-by-job for downstream reports)
//   - over/under estimate (compare against bid labor estimate)
//
// Pure derivation. No persisted records.

import type { DirClassification, Employee } from './employee';
import type { TimeCard } from './time-card';
import { entryWorkedMinutes } from './time-card';

export interface JobHoursCell {
  jobId: string;
  hours: number;
}

export interface EmployeeLaborCostRow {
  employeeId: string;
  employeeName: string;
  classification: DirClassification;
  totalHours: number;
  /** Hours by job (sorted desc). */
  hoursByJob: JobHoursCell[];
  hourlyRateCents: number;
  /** totalHours * hourlyRateCents. */
  totalCostCents: number;
  /** Number of timecards considered. */
  timeCards: number;
}

export interface LaborCostRollup {
  employeesConsidered: number;
  totalHours: number;
  totalCostCents: number;
}

export interface LaborCostInputs {
  /** Optional yyyy-mm-dd window applied to time entry dates. */
  fromDate?: string;
  toDate?: string;
  employees: Employee[];
  timeCards: TimeCard[];
  /** Per-classification hourly rate in cents. */
  ratesByClassification: Map<DirClassification, number>;
  /** When false (default), only ACTIVE employees are scored. */
  includeAllStatuses?: boolean;
}

export function buildEmployeeLaborCost(inputs: LaborCostInputs): {
  rollup: LaborCostRollup;
  rows: EmployeeLaborCostRow[];
} {
  const includeAll = inputs.includeAllStatuses === true;
  const inRange = (d: string) => {
    if (inputs.fromDate && d < inputs.fromDate) return false;
    if (inputs.toDate && d > inputs.toDate) return false;
    return true;
  };

  // Lookup employee by id so we can resolve classification + name.
  const empById = new Map<string, Employee>();
  for (const e of inputs.employees) empById.set(e.id, e);

  // Aggregate per-employee.
  type Bucket = {
    employeeId: string;
    minutes: number;
    perJob: Map<string, number>; // job → minutes
    timeCards: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const card of inputs.timeCards) {
    if (card.status === 'DRAFT' || card.status === 'REJECTED') continue;
    const b = buckets.get(card.employeeId) ?? {
      employeeId: card.employeeId,
      minutes: 0,
      perJob: new Map<string, number>(),
      timeCards: 0,
    };
    b.timeCards += 1;
    for (const entry of card.entries) {
      if (!inRange(entry.date)) continue;
      const m = entryWorkedMinutes(entry);
      b.minutes += m;
      b.perJob.set(entry.jobId, (b.perJob.get(entry.jobId) ?? 0) + m);
    }
    buckets.set(card.employeeId, b);
  }

  const rows: EmployeeLaborCostRow[] = [];
  let totalHours = 0;
  let totalCost = 0;

  for (const e of inputs.employees) {
    if (!includeAll && e.status !== 'ACTIVE') continue;
    const b = buckets.get(e.id);
    const hours = b ? round2(b.minutes / 60) : 0;
    const rate = inputs.ratesByClassification.get(e.classification) ?? 0;
    const costRaw = b ? (b.minutes / 60) * rate : 0;
    const cost = Math.round(costRaw);
    const perJob: JobHoursCell[] = b
      ? Array.from(b.perJob.entries())
          .map(([jobId, minutes]) => ({
            jobId,
            hours: round2(minutes / 60),
          }))
          .sort((a, b) => b.hours - a.hours)
      : [];
    rows.push({
      employeeId: e.id,
      employeeName: `${e.firstName} ${e.lastName}`.trim(),
      classification: e.classification,
      totalHours: hours,
      hoursByJob: perJob,
      hourlyRateCents: rate,
      totalCostCents: cost,
      timeCards: b?.timeCards ?? 0,
    });
    totalHours += hours;
    totalCost += cost;
  }

  // Highest cost first (payroll-impact ranked).
  rows.sort((a, b) => b.totalCostCents - a.totalCostCents);

  return {
    rollup: {
      employeesConsidered: rows.length,
      totalHours: round2(totalHours),
      totalCostCents: totalCost,
    },
    rows,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
