// Job-anchored per-responsible-party punch list detail snapshot.
//
// Plain English: for one job, return one row per responsible party
// (in-house crew, sub) with punch list items: total, open, closed,
// safety / major / minor breakouts, overdue count, last identified
// date. Sorted by open desc.
//
// Pure derivation. No persisted records.

import type { PunchItem } from './punch-list';

export interface JobPunchDetailRow {
  responsibleParty: string;
  total: number;
  open: number;
  closed: number;
  safety: number;
  major: number;
  minor: number;
  overdue: number;
  lastIdentifiedDate: string | null;
}

export interface JobPunchDetailSnapshotResult {
  asOf: string;
  jobId: string;
  rows: JobPunchDetailRow[];
}

export interface JobPunchDetailSnapshotInputs {
  jobId: string;
  punchItems: PunchItem[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

const OPEN_STATUSES = new Set(['OPEN', 'IN_PROGRESS', 'DISPUTED']);

export function buildJobPunchDetailSnapshot(
  inputs: JobPunchDetailSnapshotInputs,
): JobPunchDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  type Acc = {
    total: number;
    open: number;
    closed: number;
    safety: number;
    major: number;
    minor: number;
    overdue: number;
    lastDate: string | null;
  };
  const byParty = new Map<string, Acc>();
  function getAcc(party: string): Acc {
    let a = byParty.get(party);
    if (!a) {
      a = { total: 0, open: 0, closed: 0, safety: 0, major: 0, minor: 0, overdue: 0, lastDate: null };
      byParty.set(party, a);
    }
    return a;
  }

  for (const p of inputs.punchItems) {
    if (p.jobId !== inputs.jobId) continue;
    if (p.identifiedOn > asOf) continue;
    const party = (p.responsibleParty ?? '').trim() || '(unassigned)';
    const a = getAcc(party);
    a.total += 1;
    if (p.status === 'CLOSED' || p.status === 'WAIVED') a.closed += 1;
    if (OPEN_STATUSES.has(p.status)) a.open += 1;
    if (p.severity === 'SAFETY') a.safety += 1;
    else if (p.severity === 'MAJOR') a.major += 1;
    else if (p.severity === 'MINOR') a.minor += 1;
    if (OPEN_STATUSES.has(p.status) && p.dueOn && p.dueOn < asOf) a.overdue += 1;
    if (a.lastDate == null || p.identifiedOn > a.lastDate) a.lastDate = p.identifiedOn;
  }

  const rows: JobPunchDetailRow[] = [...byParty.entries()]
    .map(([responsibleParty, a]) => ({
      responsibleParty,
      total: a.total,
      open: a.open,
      closed: a.closed,
      safety: a.safety,
      major: a.major,
      minor: a.minor,
      overdue: a.overdue,
      lastIdentifiedDate: a.lastDate,
    }))
    .sort((a, b) => b.open - a.open || b.total - a.total || a.responsibleParty.localeCompare(b.responsibleParty));

  return {
    asOf,
    jobId: inputs.jobId,
    rows,
  };
}
