// Certified-Payroll-Report draft builder.
//
// Plain English: given the week's time cards + the employee roster +
// the jobId of interest, this returns a list of CprEmployeeRow rows
// pre-filled with daily hours / straight vs overtime / classification
// snapshot. The office still has to review + add rates + sign + submit,
// but the rolling-up from time-cards is the tedious part this removes.
//
// Source of truth for hours: TimeCard.entries filtered to this jobId.
// Each entry contributes worked-minutes (via entryWorkedMinutes) to the
// day-of-week bucket derived from entry.date.
//
// Overtime split (CA Labor Code §510 + IWC Wage Orders):
//   - All hours > 8 in a single day are OT.
//   - All hours > 40 in a workweek are OT (when not already counted as
//     daily OT).
//   - All hours > 12 in a single day are DOUBLE TIME — captured in the
//     OT bucket here, with a flag the caller can promote (a future
//     bundle adds a doubleTimeHours field to CprEmployeeRow).
//
// Pure derivation. No DB.

import { DirClassificationSchema, type DirClassification, type Employee } from './employee';
import {
  entryWorkedMinutes,
  type TimeCard,
} from './time-card';

const DAY_OF_WEEK_FROM_MONDAY = (isoDate: string): number => {
  // Sunday = 0 in JS, Monday = 1. We want Mon=0, Sun=6 for the
  // [Mon..Sun] 7-tuple the CprEmployeeRow expects.
  const d = new Date(`${isoDate}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0 = Sun
  return (dow + 6) % 7;
};

export interface DraftCprRow {
  employeeId: string;
  name: string;
  classification: DirClassification;
  dailyHours: [number, number, number, number, number, number, number];
  straightHours: number;
  overtimeHours: number;
  doubleTimeHours: number;
  /** True when the time cards for this employee + week have any
   *  entries that aren't for this job — caller may want to display a
   *  hint that this row only reflects partial-week hours. */
  hasOtherJobHours: boolean;
}

export interface BuildDraftCprInput {
  jobId: string;
  weekStarting: string; // yyyy-mm-dd (Monday)
  timeCards: TimeCard[];
  employees: Employee[];
}

export function buildDraftCprRows(input: BuildDraftCprInput): DraftCprRow[] {
  const byEmployee = new Map<string, TimeCard>();
  for (const card of input.timeCards) {
    if (card.weekStarting !== input.weekStarting) continue;
    byEmployee.set(card.employeeId, card);
  }
  const employeeById = new Map(input.employees.map((e) => [e.id, e]));

  const rows: DraftCprRow[] = [];
  for (const [employeeId, card] of byEmployee.entries()) {
    const employee = employeeById.get(employeeId);
    if (!employee) continue;

    const daily: [number, number, number, number, number, number, number] = [
      0, 0, 0, 0, 0, 0, 0,
    ];
    let totalAllJobsMin = 0;
    let hasOtherJobHours = false;

    for (const entry of card.entries) {
      const minutes = entryWorkedMinutes(entry);
      totalAllJobsMin += minutes;
      if (entry.jobId !== input.jobId) {
        if (minutes > 0) hasOtherJobHours = true;
        continue;
      }
      const idx = DAY_OF_WEEK_FROM_MONDAY(entry.date);
      if (idx >= 0 && idx < 7) {
        daily[idx] = round2(daily[idx]! + minutes / 60);
      }
    }

    const { straight, overtime, doubleTime } = splitOvertime(daily);

    rows.push({
      employeeId,
      name: fullName(employee),
      classification: employee.classification ?? DirClassificationSchema.options[0]!,
      dailyHours: daily,
      straightHours: round2(straight),
      overtimeHours: round2(overtime),
      doubleTimeHours: round2(doubleTime),
      hasOtherJobHours,
    });
    void totalAllJobsMin;
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

/** CA daily/weekly overtime split per §510 + IWC Wage Orders:
 *    Straight = min(daily, 8) summed, capped at 40 weekly
 *    OT       = daily 8..12 hours, plus weekly straight overflow >40
 *    DT       = daily > 12 hours
 *  Pure: takes daily hours, returns the split. */
export function splitOvertime(daily: readonly number[]): {
  straight: number;
  overtime: number;
  doubleTime: number;
} {
  let straight = 0;
  let overtime = 0;
  let doubleTime = 0;

  for (const h of daily) {
    if (h <= 0) continue;
    const dt = Math.max(0, h - 12);
    const ot = Math.max(0, Math.min(h, 12) - 8);
    const st = Math.max(0, Math.min(h, 8));
    straight += st;
    overtime += ot;
    doubleTime += dt;
  }

  // Weekly cap on straight: anything over 40 weekly hours of "straight"
  // becomes overtime even if no single day exceeded 8.
  if (straight > 40) {
    overtime += straight - 40;
    straight = 40;
  }

  return {
    straight: round2(straight),
    overtime: round2(overtime),
    doubleTime: round2(doubleTime),
  };
}

function fullName(e: Employee): string {
  const first = e.displayName ?? e.firstName;
  return `${e.lastName}, ${first}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
