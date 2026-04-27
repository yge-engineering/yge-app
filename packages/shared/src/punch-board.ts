// Cross-job punch list aggregator.
//
// Plain English: when a job hits substantial completion, the
// walkthrough generates a list of items that have to be fixed before
// the agency releases final payment + retention. As jobs stack up,
// open punch items spread across them, and it's hard to tell who's
// holding up which job. This rolls every open punch item into one
// dashboard with three sorts:
//
//   1. By job — what's blocking each job's closeout.
//   2. By responsible party — which sub or in-house crew owes us
//      the most fixes (chase list).
//   3. By severity — SAFETY first, then MAJOR, then MINOR.
//
// Pure derivation. No persisted records.

import type { PunchItem, PunchItemSeverity, PunchItemStatus } from './punch-list';

export interface PunchBoardRow {
  id: string;
  jobId: string;
  /** Job display name when caller provides the lookup. */
  projectName: string;
  identifiedOn: string;
  location: string;
  description: string;
  severity: PunchItemSeverity;
  status: PunchItemStatus;
  responsibleParty?: string;
  dueOn?: string;
  /** Days past due. Negative = future-due. Null when no dueOn. */
  daysPastDue: number | null;
  /** Days since identified. Always non-negative. */
  daysOpen: number;
}

export interface PunchBoardJobRollup {
  jobId: string;
  projectName: string;
  totalOpen: number;
  safety: number;
  major: number;
  minor: number;
  /** Oldest still-open item's daysOpen. Drives sort. */
  oldestDaysOpen: number;
}

export interface PunchBoardPartyRollup {
  party: string;
  totalOpen: number;
  safety: number;
  major: number;
  minor: number;
  oldestDaysOpen: number;
}

export interface PunchBoard {
  asOf: string;
  rows: PunchBoardRow[];
  byJob: PunchBoardJobRollup[];
  byParty: PunchBoardPartyRollup[];
  totals: {
    totalOpen: number;
    safety: number;
    major: number;
    minor: number;
    pastDue: number;
  };
}

export interface PunchBoardInputs {
  /** ISO yyyy-mm-dd; defaults to today (UTC). */
  asOf?: string;
  punchItems: PunchItem[];
  /** Optional jobId → projectName lookup. */
  jobNamesById?: Map<string, string>;
  /** When true, include CLOSED + WAIVED rows at the bottom of the
   *  list. Default: false (only OPEN/IN_PROGRESS/DISPUTED). */
  includeResolved?: boolean;
}

export function buildPunchBoard(inputs: PunchBoardInputs): PunchBoard {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const includeResolved = inputs.includeResolved === true;
  const jobNamesById = inputs.jobNamesById;

  const rows: PunchBoardRow[] = [];

  for (const p of inputs.punchItems) {
    const isResolved = p.status === 'CLOSED' || p.status === 'WAIVED';
    if (isResolved && !includeResolved) continue;

    const daysOpen = Math.max(0, daysBetween(p.identifiedOn, asOf));
    const daysPastDue = p.dueOn ? daysBetween(p.dueOn, asOf) : null;

    rows.push({
      id: p.id,
      jobId: p.jobId,
      projectName: jobNamesById?.get(p.jobId) ?? p.jobId,
      identifiedOn: p.identifiedOn,
      location: p.location,
      description: p.description,
      severity: p.severity,
      status: p.status,
      responsibleParty: p.responsibleParty,
      dueOn: p.dueOn,
      daysPastDue,
      daysOpen,
    });
  }

  // Sort: SAFETY first, then MAJOR, then MINOR. Within severity,
  // past-due items first (largest daysPastDue), then oldest first.
  const sevRank: Record<PunchItemSeverity, number> = {
    SAFETY: 0,
    MAJOR: 1,
    MINOR: 2,
  };
  rows.sort((a, b) => {
    if (a.severity !== b.severity) {
      return sevRank[a.severity] - sevRank[b.severity];
    }
    const ad = a.daysPastDue ?? Number.NEGATIVE_INFINITY;
    const bd = b.daysPastDue ?? Number.NEGATIVE_INFINITY;
    if (ad !== bd) return bd - ad;
    return b.daysOpen - a.daysOpen;
  });

  // Per-job rollup.
  const byJobMap = new Map<string, PunchBoardJobRollup>();
  for (const r of rows) {
    const cur =
      byJobMap.get(r.jobId) ??
      ({
        jobId: r.jobId,
        projectName: r.projectName,
        totalOpen: 0,
        safety: 0,
        major: 0,
        minor: 0,
        oldestDaysOpen: 0,
      } as PunchBoardJobRollup);
    cur.totalOpen += 1;
    if (r.severity === 'SAFETY') cur.safety += 1;
    else if (r.severity === 'MAJOR') cur.major += 1;
    else cur.minor += 1;
    if (r.daysOpen > cur.oldestDaysOpen) cur.oldestDaysOpen = r.daysOpen;
    byJobMap.set(r.jobId, cur);
  }
  const byJob = Array.from(byJobMap.values()).sort((a, b) => {
    // Most safety items first, then most major, then oldest.
    if (a.safety !== b.safety) return b.safety - a.safety;
    if (a.major !== b.major) return b.major - a.major;
    return b.oldestDaysOpen - a.oldestDaysOpen;
  });

  // Per-party rollup. "Unassigned" bucket for items without
  // responsibleParty.
  const byPartyMap = new Map<string, PunchBoardPartyRollup>();
  for (const r of rows) {
    const key = (r.responsibleParty?.trim() || 'Unassigned');
    const cur =
      byPartyMap.get(key) ??
      ({
        party: key,
        totalOpen: 0,
        safety: 0,
        major: 0,
        minor: 0,
        oldestDaysOpen: 0,
      } as PunchBoardPartyRollup);
    cur.totalOpen += 1;
    if (r.severity === 'SAFETY') cur.safety += 1;
    else if (r.severity === 'MAJOR') cur.major += 1;
    else cur.minor += 1;
    if (r.daysOpen > cur.oldestDaysOpen) cur.oldestDaysOpen = r.daysOpen;
    byPartyMap.set(key, cur);
  }
  const byParty = Array.from(byPartyMap.values()).sort((a, b) => {
    if (a.safety !== b.safety) return b.safety - a.safety;
    if (a.totalOpen !== b.totalOpen) return b.totalOpen - a.totalOpen;
    return b.oldestDaysOpen - a.oldestDaysOpen;
  });

  let safety = 0;
  let major = 0;
  let minor = 0;
  let pastDue = 0;
  for (const r of rows) {
    if (r.severity === 'SAFETY') safety += 1;
    else if (r.severity === 'MAJOR') major += 1;
    else minor += 1;
    if (r.daysPastDue != null && r.daysPastDue > 0) pastDue += 1;
  }

  return {
    asOf,
    rows,
    byJob,
    byParty,
    totals: {
      totalOpen: rows.length,
      safety,
      major,
      minor,
      pastDue,
    },
  };
}

/** Calendar days between two yyyy-mm-dd strings (signed: positive
 *  when `to` is later than `from`). UTC math. */
function daysBetween(from: string, to: string): number {
  const f = Date.parse(`${from}T00:00:00Z`);
  const t = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(f) || Number.isNaN(t)) return 0;
  return Math.round((t - f) / (24 * 60 * 60 * 1000));
}
