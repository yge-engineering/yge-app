// Per-job time-card hours rollup.
//
// Plain English: job-classification-mix uses CertifiedPayroll
// (the official record sent to DIR). This module uses TimeCards
// (the operational, near-real-time labor record). They tell
// different stories at different times in a pay cycle:
//   - TimeCards exist immediately after the work day; CPRs lag
//     by a week
//   - TimeCards are pre-payroll; CPRs are post-payroll
//
// Per AWARDED job, walks non-DRAFT/non-REJECTED time cards in
// the window and rolls up hours by classification + by employee.
//
// Pure derivation. No persisted records.

import type { DirClassification, Employee } from './employee';
import type { TimeCard } from './time-card';
import { entryWorkedMinutes } from './time-card';

export interface JobTimecardClassificationCell {
  classification: DirClassification;
  hours: number;
}

export interface JobTimecardEmployeeCell {
  employeeId: string;
  employeeName: string;
  classification: DirClassification;
  hours: number;
}

export interface JobTimecardHoursRow {
  jobId: string;
  totalHours: number;
  hoursByClassification: JobTimecardClassificationCell[];
  hoursByEmployee: JobTimecardEmployeeCell[];
  /** Number of distinct employees on the job in window. */
  distinctEmployees: number;
  /** Number of timecards that contributed to this job. */
  timeCardsTouched: number;
}

export interface JobTimecardHoursRollup {
  jobsConsidered: number;
  totalHours: number;
}

export interface JobTimecardHoursInputs {
  /** Optional yyyy-mm-dd window applied per time-entry date. */
  fromDate?: string;
  toDate?: string;
  employees: Employee[];
  timeCards: TimeCard[];
}

export function buildJobTimecardHours(
  inputs: JobTimecardHoursInputs,
): {
  rollup: JobTimecardHoursRollup;
  rows: JobTimecardHoursRow[];
} {
  const inRange = (d: string) => {
    if (inputs.fromDate && d < inputs.fromDate) return false;
    if (inputs.toDate && d > inputs.toDate) return false;
    return true;
  };

  const empById = new Map<string, Employee>();
  for (const e of inputs.employees) empById.set(e.id, e);

  type Bucket = {
    jobId: string;
    minutes: number;
    perClass: Map<DirClassification, number>;
    perEmp: Map<string, number>;
    cardIds: Set<string>;
  };
  const buckets = new Map<string, Bucket>();

  for (const card of inputs.timeCards) {
    if (card.status === 'DRAFT' || card.status === 'REJECTED') continue;
    const emp = empById.get(card.employeeId);
    const classification: DirClassification = emp?.classification ?? 'OTHER';
    for (const entry of card.entries) {
      if (!inRange(entry.date)) continue;
      const m = entryWorkedMinutes(entry);
      if (m === 0) continue;
      const b = buckets.get(entry.jobId) ?? {
        jobId: entry.jobId,
        minutes: 0,
        perClass: new Map<DirClassification, number>(),
        perEmp: new Map<string, number>(),
        cardIds: new Set<string>(),
      };
      b.minutes += m;
      b.perClass.set(classification, (b.perClass.get(classification) ?? 0) + m);
      b.perEmp.set(card.employeeId, (b.perEmp.get(card.employeeId) ?? 0) + m);
      b.cardIds.add(card.id);
      buckets.set(entry.jobId, b);
    }
  }

  const rows: JobTimecardHoursRow[] = [];
  let grandHours = 0;

  for (const b of buckets.values()) {
    const totalHours = round2(b.minutes / 60);

    const hoursByClassification: JobTimecardClassificationCell[] = Array.from(
      b.perClass.entries(),
    )
      .map(([classification, minutes]) => ({
        classification,
        hours: round2(minutes / 60),
      }))
      .sort((a, b) => b.hours - a.hours);

    const hoursByEmployee: JobTimecardEmployeeCell[] = Array.from(
      b.perEmp.entries(),
    )
      .map(([empId, minutes]) => {
        const e = empById.get(empId);
        return {
          employeeId: empId,
          employeeName: e ? `${e.firstName} ${e.lastName}`.trim() : empId,
          classification: e?.classification ?? 'OTHER',
          hours: round2(minutes / 60),
        };
      })
      .sort((a, b) => b.hours - a.hours);

    rows.push({
      jobId: b.jobId,
      totalHours,
      hoursByClassification,
      hoursByEmployee,
      distinctEmployees: b.perEmp.size,
      timeCardsTouched: b.cardIds.size,
    });
    grandHours += totalHours;
  }

  // Highest-hours job first.
  rows.sort((a, b) => b.totalHours - a.totalHours);

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalHours: round2(grandHours),
    },
    rows,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
