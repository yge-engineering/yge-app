// Per-foreman crew turnover.
//
// Plain English: for each foreman (by DR.foremanId), walk every
// submitted DR they filed and surface their crew shape over time.
// A foreman with 8 distinct crew members across 30 DRs probably
// has a stable crew; one with 25 distinct crew members across 30
// DRs is constantly shuffling and burning learning curve.
//
// Per row: crewDayCount (sum of crew rows across DRs),
// distinctCrewMembers, firstDr / lastDr, transientShare (share of
// distinct crew who appeared on only ONE DR — the rotation
// indicator), oneAppearanceCount, longHaulCount (employees on
// 5+ DRs).
//
// Different from foreman-scorecard (broader metrics) and
// foreman-throughput (delivered hours). This is the crew
// composition stability view.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';

export interface ForemanCrewTurnoverRow {
  foremanId: string;
  drCount: number;
  crewDayCount: number;
  distinctCrewMembers: number;
  /** Share of distinct crew who appeared on exactly one DR. */
  transientShare: number;
  oneAppearanceCount: number;
  /** Employees on 5+ of this foreman's DRs. */
  longHaulCount: number;
  firstDr: string;
  lastDr: string;
}

export interface ForemanCrewTurnoverRollup {
  foremenConsidered: number;
  totalDrs: number;
  /** Blended transient share across the portfolio. */
  blendedTransientShare: number;
}

export interface ForemanCrewTurnoverInputs {
  reports: DailyReport[];
  /** Inclusive yyyy-mm-dd window applied to DR.date. */
  fromDate?: string;
  toDate?: string;
  /** Threshold for the long-haul flag — default 5 DRs. */
  longHaulThreshold?: number;
}

export function buildForemanCrewTurnover(
  inputs: ForemanCrewTurnoverInputs,
): {
  rollup: ForemanCrewTurnoverRollup;
  rows: ForemanCrewTurnoverRow[];
} {
  const longHaul = inputs.longHaulThreshold ?? 5;

  type Acc = {
    foremanId: string;
    drs: Set<string>;
    crewDays: number;
    /** Map<empId, appearanceCount> */
    appearances: Map<string, number>;
    firstDr: string;
    lastDr: string;
  };
  const accs = new Map<string, Acc>();

  for (const r of inputs.reports) {
    if (!r.submitted) continue;
    if (inputs.fromDate && r.date < inputs.fromDate) continue;
    if (inputs.toDate && r.date > inputs.toDate) continue;
    const acc = accs.get(r.foremanId) ?? {
      foremanId: r.foremanId,
      drs: new Set<string>(),
      crewDays: 0,
      appearances: new Map<string, number>(),
      firstDr: '',
      lastDr: '',
    };
    acc.drs.add(r.id);
    if (acc.firstDr === '' || r.date < acc.firstDr) acc.firstDr = r.date;
    if (r.date > acc.lastDr) acc.lastDr = r.date;
    for (const row of r.crewOnSite) {
      acc.crewDays += 1;
      acc.appearances.set(row.employeeId, (acc.appearances.get(row.employeeId) ?? 0) + 1);
    }
    accs.set(r.foremanId, acc);
  }

  let totalDrs = 0;
  let blendedDistinct = 0;
  let blendedOnce = 0;

  const rows: ForemanCrewTurnoverRow[] = [];
  for (const acc of accs.values()) {
    const distinct = acc.appearances.size;
    let onceCount = 0;
    let longHaulCount = 0;
    for (const count of acc.appearances.values()) {
      if (count === 1) onceCount += 1;
      if (count >= longHaul) longHaulCount += 1;
    }
    const transientShare = distinct === 0
      ? 0
      : Math.round((onceCount / distinct) * 10_000) / 10_000;

    rows.push({
      foremanId: acc.foremanId,
      drCount: acc.drs.size,
      crewDayCount: acc.crewDays,
      distinctCrewMembers: distinct,
      transientShare,
      oneAppearanceCount: onceCount,
      longHaulCount,
      firstDr: acc.firstDr,
      lastDr: acc.lastDr,
    });

    totalDrs += acc.drs.size;
    blendedDistinct += distinct;
    blendedOnce += onceCount;
  }

  // Sort: highest transient share first (most rotation).
  rows.sort((a, b) => {
    if (a.transientShare !== b.transientShare) return b.transientShare - a.transientShare;
    return b.distinctCrewMembers - a.distinctCrewMembers;
  });

  return {
    rollup: {
      foremenConsidered: rows.length,
      totalDrs,
      blendedTransientShare: blendedDistinct === 0
        ? 0
        : Math.round((blendedOnce / blendedDistinct) * 10_000) / 10_000,
    },
    rows,
  };
}
