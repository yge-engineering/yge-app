// Per-month time-card hours summary.
//
// Plain English: bucket every time-card entry by yyyy-mm of its
// date, summing worked hours via entryWorkedMinutes (consistent
// with the rest of the system). Per month: total hours,
// distinct employees, distinct jobs, distinct cost codes.
//
// Different from cpr-monthly-cadence (public-works only) and
// payroll-summary (per-pay-period \$). This is the all-hours
// time-card volume view across the portfolio.
//
// Pure derivation. No persisted records.

import {
  type TimeCard,
  entryWorkedMinutes,
} from './time-card';

export interface TimeCardMonthRow {
  month: string;
  totalHours: number;
  distinctEmployees: number;
  distinctJobs: number;
  cardCount: number;
}

export interface TimeCardMonthlyRollup {
  monthsConsidered: number;
  totalHours: number;
  /** Latest vs prior month delta in hours. 0 with <2 months. */
  monthOverMonthHoursChange: number;
}

export interface TimeCardMonthlyInputs {
  timeCards: TimeCard[];
  fromMonth?: string;
  toMonth?: string;
  /** Skip DRAFT cards. Default true. */
  skipDraft?: boolean;
}

export function buildTimeCardMonthlyHours(
  inputs: TimeCardMonthlyInputs,
): {
  rollup: TimeCardMonthlyRollup;
  rows: TimeCardMonthRow[];
} {
  const skipDraft = inputs.skipDraft !== false;

  type Bucket = {
    month: string;
    minutes: number;
    employees: Set<string>;
    jobs: Set<string>;
    cards: Set<string>;
  };
  const buckets = new Map<string, Bucket>();

  for (const card of inputs.timeCards) {
    if (skipDraft && card.status === 'DRAFT') continue;
    for (const entry of card.entries) {
      const month = entry.date.slice(0, 7);
      if (inputs.fromMonth && month < inputs.fromMonth) continue;
      if (inputs.toMonth && month > inputs.toMonth) continue;
      const b = buckets.get(month) ?? {
        month,
        minutes: 0,
        employees: new Set<string>(),
        jobs: new Set<string>(),
        cards: new Set<string>(),
      };
      b.minutes += entryWorkedMinutes(entry);
      b.employees.add(card.employeeId);
      b.jobs.add(entry.jobId);
      b.cards.add(card.id);
      buckets.set(month, b);
    }
  }

  const rows: TimeCardMonthRow[] = Array.from(buckets.values())
    .map((b) => ({
      month: b.month,
      totalHours: round2(b.minutes / 60),
      distinctEmployees: b.employees.size,
      distinctJobs: b.jobs.size,
      cardCount: b.cards.size,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  let mom = 0;
  if (rows.length >= 2) {
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    if (last && prev) mom = round2(last.totalHours - prev.totalHours);
  }

  let totalHours = 0;
  for (const r of rows) totalHours += r.totalHours;

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalHours: round2(totalHours),
      monthOverMonthHoursChange: mom,
    },
    rows,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
