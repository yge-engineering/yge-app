// Punch-list aging tracker.
//
// Plain English: substantial completion walkthrough produced a punch
// list. Each item has a responsible party (sub or in-house crew),
// a severity (SAFETY/MAJOR/MINOR), and a 'days open' clock starting
// from identifiedOn. The longer an item sits, the longer until
// retention releases. SAFETY items are payment blockers; MAJOR
// items block final payment.
//
// This walks open punch items and:
//   - tiers each by age (NEW <14, AGING 14-29, STALE 30-59, STUCK 60+)
//   - rolls up per responsible party
//   - rolls up per severity
//
// Pure derivation. No persisted records.

import type { PunchItem, PunchItemSeverity } from './punch-list';

export type PunchAgeFlag = 'NEW' | 'AGING' | 'STALE' | 'STUCK';

export interface PunchAgingRow {
  punchItemId: string;
  jobId: string;
  identifiedOn: string;
  daysOpen: number;
  severity: PunchItemSeverity;
  status: PunchItem['status'];
  location: string;
  responsibleParty: string;
  flag: PunchAgeFlag;
  /** True iff dueOn is set and asOf is past it. */
  pastDue: boolean;
}

export interface PunchAgingByParty {
  responsibleParty: string;
  openCount: number;
  oldestDaysOpen: number;
  /** Counts by severity within the party's open items. */
  safetyCount: number;
  majorCount: number;
  minorCount: number;
}

export interface PunchAgingRollup {
  totalOpen: number;
  newCount: number;
  agingCount: number;
  staleCount: number;
  stuckCount: number;
  safetyOpen: number;
  majorOpen: number;
  minorOpen: number;
  pastDueCount: number;
}

export interface PunchAgingInputs {
  asOf?: string;
  punchItems: PunchItem[];
}

export function buildPunchAging(inputs: PunchAgingInputs): {
  rollup: PunchAgingRollup;
  rows: PunchAgingRow[];
  byParty: PunchAgingByParty[];
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const refNow = new Date(`${asOf}T00:00:00Z`);

  const rows: PunchAgingRow[] = [];
  const byPartyMap = new Map<string, PunchAgingByParty>();
  const rollup: PunchAgingRollup = {
    totalOpen: 0,
    newCount: 0,
    agingCount: 0,
    staleCount: 0,
    stuckCount: 0,
    safetyOpen: 0,
    majorOpen: 0,
    minorOpen: 0,
    pastDueCount: 0,
  };

  for (const pi of inputs.punchItems) {
    if (pi.status === 'CLOSED' || pi.status === 'WAIVED') continue;

    const idDate = parseDate(pi.identifiedOn);
    const daysOpen = idDate ? Math.max(0, daysBetween(idDate, refNow)) : 0;
    const flag = classify(daysOpen);
    const responsibleParty = (pi.responsibleParty ?? 'Unassigned').trim() || 'Unassigned';

    let pastDue = false;
    if (pi.dueOn) {
      const dueDate = parseDate(pi.dueOn);
      if (dueDate && dueDate.getTime() < refNow.getTime()) pastDue = true;
    }

    rows.push({
      punchItemId: pi.id,
      jobId: pi.jobId,
      identifiedOn: pi.identifiedOn,
      daysOpen,
      severity: pi.severity,
      status: pi.status,
      location: pi.location,
      responsibleParty,
      flag,
      pastDue,
    });

    rollup.totalOpen += 1;
    if (flag === 'NEW') rollup.newCount += 1;
    else if (flag === 'AGING') rollup.agingCount += 1;
    else if (flag === 'STALE') rollup.staleCount += 1;
    else rollup.stuckCount += 1;
    if (pi.severity === 'SAFETY') rollup.safetyOpen += 1;
    else if (pi.severity === 'MAJOR') rollup.majorOpen += 1;
    else rollup.minorOpen += 1;
    if (pastDue) rollup.pastDueCount += 1;

    const p = byPartyMap.get(responsibleParty) ?? {
      responsibleParty,
      openCount: 0,
      oldestDaysOpen: 0,
      safetyCount: 0,
      majorCount: 0,
      minorCount: 0,
    };
    p.openCount += 1;
    if (daysOpen > p.oldestDaysOpen) p.oldestDaysOpen = daysOpen;
    if (pi.severity === 'SAFETY') p.safetyCount += 1;
    else if (pi.severity === 'MAJOR') p.majorCount += 1;
    else p.minorCount += 1;
    byPartyMap.set(responsibleParty, p);
  }

  // Worst tier first; then SAFETY > MAJOR > MINOR; then days-open desc.
  const tierRank: Record<PunchAgeFlag, number> = {
    STUCK: 0,
    STALE: 1,
    AGING: 2,
    NEW: 3,
  };
  const sevRank: Record<PunchItemSeverity, number> = {
    SAFETY: 0,
    MAJOR: 1,
    MINOR: 2,
  };
  rows.sort((a, b) => {
    if (a.flag !== b.flag) return tierRank[a.flag] - tierRank[b.flag];
    if (a.severity !== b.severity) return sevRank[a.severity] - sevRank[b.severity];
    return b.daysOpen - a.daysOpen;
  });

  const byParty = Array.from(byPartyMap.values()).sort(
    (a, b) => b.openCount - a.openCount,
  );

  return { rollup, rows, byParty };
}

function classify(days: number): PunchAgeFlag {
  if (days < 14) return 'NEW';
  if (days < 30) return 'AGING';
  if (days < 60) return 'STALE';
  return 'STUCK';
}

function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}
