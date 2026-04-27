// Per-employee crew co-occurrence map.
//
// Plain English: across submitted daily reports in a window, count
// the days each pair of employees appeared on the same crew. Tells
// management:
//   - which pairs work together a lot (knowledge transfer pairs,
//     candidates for crew leads)
//   - which pairs have been split apart (people whose crews used
//     to be glued together)
//   - which employees rarely partner with anyone (silos / new hires
//     who haven't been integrated)
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';

export interface CooccurrenceRow {
  employeeAId: string;
  employeeBId: string;
  daysTogether: number;
  /** Distinct jobs they worked together on. */
  jobsTogether: number;
  /** Most recent date they were on the same crew. */
  lastTogetherDate: string;
}

export interface PerEmployeeRow {
  employeeId: string;
  drsAppearedOn: number;
  /** Distinct partners across all DRs in the window. */
  distinctPartners: number;
  /** Top partner (most days together) and that pair count. */
  topPartnerId: string | null;
  topPartnerDays: number;
}

export interface CooccurrenceRollup {
  employeesConsidered: number;
  pairsConsidered: number;
  /** Pairs that were together >=10 days — "tight pair" count. */
  tightPairCount: number;
}

export interface CooccurrenceInputs {
  /** Optional yyyy-mm-dd window. */
  fromDate?: string;
  toDate?: string;
  dailyReports: DailyReport[];
  /** Min days-together for a pair to surface in pairs. Default 1. */
  minDaysTogether?: number;
}

export function buildEmployeeCooccurrence(
  inputs: CooccurrenceInputs,
): {
  rollup: CooccurrenceRollup;
  pairs: CooccurrenceRow[];
  perEmployee: PerEmployeeRow[];
} {
  const minDays = inputs.minDaysTogether ?? 1;
  const inRange = (d: string) => {
    if (inputs.fromDate && d < inputs.fromDate) return false;
    if (inputs.toDate && d > inputs.toDate) return false;
    return true;
  };

  // pairKey "a|b" (a < b alphabetically) → bucket.
  type PairBucket = {
    a: string;
    b: string;
    days: Set<string>;
    jobs: Set<string>;
    lastDate: string;
  };
  const pairs = new Map<string, PairBucket>();

  // employeeId → set of distinct partners + DR count.
  type EmpBucket = {
    employeeId: string;
    drsAppearedOn: number;
    partners: Map<string, number>; // partner id → days together
  };
  const employees = new Map<string, EmpBucket>();

  for (const dr of inputs.dailyReports) {
    if (!dr.submitted) continue;
    if (!inRange(dr.date)) continue;
    const ids = Array.from(
      new Set(dr.crewOnSite.map((r) => r.employeeId).filter(Boolean)),
    );
    for (const id of ids) {
      const e = employees.get(id) ?? {
        employeeId: id,
        drsAppearedOn: 0,
        partners: new Map<string, number>(),
      };
      e.drsAppearedOn += 1;
      employees.set(id, e);
    }
    // Pair every two distinct employees on this DR.
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const aRaw = ids[i]!;
        const bRaw = ids[j]!;
        const a = aRaw < bRaw ? aRaw : bRaw;
        const b = aRaw < bRaw ? bRaw : aRaw;
        const key = `${a}|${b}`;
        const p = pairs.get(key) ?? {
          a,
          b,
          days: new Set<string>(),
          jobs: new Set<string>(),
          lastDate: dr.date,
        };
        p.days.add(dr.date);
        p.jobs.add(dr.jobId);
        if (dr.date > p.lastDate) p.lastDate = dr.date;
        pairs.set(key, p);

        const ea = employees.get(a)!;
        const eb = employees.get(b)!;
        ea.partners.set(b, (ea.partners.get(b) ?? 0) + 1);
        eb.partners.set(a, (eb.partners.get(a) ?? 0) + 1);
      }
    }
  }

  const pairRows: CooccurrenceRow[] = [];
  let tightPairs = 0;
  for (const p of pairs.values()) {
    const days = p.days.size;
    if (days < minDays) continue;
    if (days >= 10) tightPairs += 1;
    pairRows.push({
      employeeAId: p.a,
      employeeBId: p.b,
      daysTogether: days,
      jobsTogether: p.jobs.size,
      lastTogetherDate: p.lastDate,
    });
  }
  pairRows.sort((a, b) => b.daysTogether - a.daysTogether);

  const perEmployee: PerEmployeeRow[] = [];
  for (const e of employees.values()) {
    let topId: string | null = null;
    let topDays = 0;
    for (const [partnerId, days] of e.partners.entries()) {
      if (days > topDays) {
        topDays = days;
        topId = partnerId;
      }
    }
    perEmployee.push({
      employeeId: e.employeeId,
      drsAppearedOn: e.drsAppearedOn,
      distinctPartners: e.partners.size,
      topPartnerId: topId,
      topPartnerDays: topDays,
    });
  }
  perEmployee.sort((a, b) => b.drsAppearedOn - a.drsAppearedOn);

  return {
    rollup: {
      employeesConsidered: perEmployee.length,
      pairsConsidered: pairRows.length,
      tightPairCount: tightPairs,
    },
    pairs: pairRows,
    perEmployee,
  };
}
