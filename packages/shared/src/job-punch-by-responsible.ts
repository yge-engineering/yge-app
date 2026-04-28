// Per-job punch-list breakdown by responsible party.
//
// Plain English: at closeout, the punch list ends up with one or
// more responsible parties per item — could be an in-house crew
// ("YGE — Concrete crew"), a sub ("ABC Paving"), or unassigned
// items. This module breaks each AWARDED job's punch list down
// by responsibleParty so we can see who's holding closeout up.
//
// Per row (per job): list of responsibleParty buckets each with
// counts (open / in-progress / closed / waived), oldest open
// item age, count of open MAJOR / SAFETY items.
//
// Different from punch-list-aging (portfolio aging), punch-board
// (snapshot list), and punch-closeout-velocity (close rate). This
// is the per-job who-owes-what view.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { PunchItem, PunchItemSeverity, PunchItemStatus } from './punch-list';

export interface PunchPartyBucket {
  responsibleParty: string;
  total: number;
  open: number;
  inProgress: number;
  closed: number;
  waived: number;
  disputed: number;
  /** Open MAJOR + SAFETY items (high-severity remainders). */
  highSeverityOpen: number;
  /** Oldest open item age in days from identifiedOn to asOf. Null if none open. */
  oldestOpenDays: number | null;
}

export interface JobPunchByResponsibleRow {
  jobId: string;
  projectName: string;
  totalItems: number;
  openItems: number;
  parties: PunchPartyBucket[];
  /** Items with no responsibleParty assigned. */
  unassignedTotal: number;
  unassignedOpen: number;
}

export interface JobPunchByResponsibleRollup {
  jobsConsidered: number;
  totalItems: number;
  totalOpen: number;
  totalUnassignedOpen: number;
}

export interface JobPunchByResponsibleInputs {
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  punchItems: PunchItem[];
  /** asOf yyyy-mm-dd for oldest-open age. Defaults to the latest
   *  identifiedOn observed. */
  asOf?: string;
  /** Default false — only AWARDED jobs are scored. */
  includeAllStatuses?: boolean;
}

const UNASSIGNED_KEY = '__unassigned__';

export function buildJobPunchByResponsible(
  inputs: JobPunchByResponsibleInputs,
): {
  rollup: JobPunchByResponsibleRollup;
  rows: JobPunchByResponsibleRow[];
} {
  const includeAll = inputs.includeAllStatuses === true;

  // asOf default
  let asOf = inputs.asOf;
  if (!asOf) {
    let latest = '';
    for (const p of inputs.punchItems) {
      if (p.identifiedOn > latest) latest = p.identifiedOn;
    }
    asOf = latest || '1970-01-01';
  }

  // Bucket punch items by jobId.
  const byJob = new Map<string, PunchItem[]>();
  for (const p of inputs.punchItems) {
    const list = byJob.get(p.jobId) ?? [];
    list.push(p);
    byJob.set(p.jobId, list);
  }

  let totalItems = 0;
  let totalOpen = 0;
  let totalUnassignedOpen = 0;

  const rows: JobPunchByResponsibleRow[] = [];
  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const items = byJob.get(j.id) ?? [];

    type Acc = {
      display: string;
      total: number;
      counts: Record<PunchItemStatus, number>;
      highSeverityOpen: number;
      oldestOpen: number | null;
    };
    const accs = new Map<string, Acc>();

    for (const item of items) {
      const partyKey = item.responsibleParty?.trim()
        ? canonicalize(item.responsibleParty)
        : UNASSIGNED_KEY;
      const display = partyKey === UNASSIGNED_KEY
        ? '(unassigned)'
        : (item.responsibleParty ?? '').trim();
      const acc: Acc = accs.get(partyKey) ?? {
        display,
        total: 0,
        counts: { OPEN: 0, IN_PROGRESS: 0, CLOSED: 0, WAIVED: 0, DISPUTED: 0 },
        highSeverityOpen: 0,
        oldestOpen: null,
      };
      acc.total += 1;
      acc.counts[item.status] += 1;
      const sev: PunchItemSeverity = item.severity;
      if ((sev === 'MAJOR' || sev === 'SAFETY') &&
          (item.status === 'OPEN' || item.status === 'IN_PROGRESS')) {
        acc.highSeverityOpen += 1;
      }
      if (item.status === 'OPEN' || item.status === 'IN_PROGRESS') {
        const age = daysBetween(item.identifiedOn, asOf);
        if (age >= 0 && (acc.oldestOpen === null || age > acc.oldestOpen)) {
          acc.oldestOpen = age;
        }
      }
      accs.set(partyKey, acc);
    }

    const parties: PunchPartyBucket[] = [];
    let unassignedTotal = 0;
    let unassignedOpen = 0;

    for (const [key, acc] of accs.entries()) {
      const open = acc.counts.OPEN;
      const inProgress = acc.counts.IN_PROGRESS;
      const closed = acc.counts.CLOSED;
      const waived = acc.counts.WAIVED;
      const disputed = acc.counts.DISPUTED;
      const bucket: PunchPartyBucket = {
        responsibleParty: acc.display,
        total: acc.total,
        open,
        inProgress,
        closed,
        waived,
        disputed,
        highSeverityOpen: acc.highSeverityOpen,
        oldestOpenDays: acc.oldestOpen,
      };
      if (key === UNASSIGNED_KEY) {
        unassignedTotal = acc.total;
        unassignedOpen = open + inProgress;
      }
      parties.push(bucket);
    }

    // Sort parties by openCount desc, then total desc.
    parties.sort((a, b) => {
      if (a.open !== b.open) return b.open - a.open;
      return b.total - a.total;
    });

    const jobOpen = items.filter((i) => i.status === 'OPEN' || i.status === 'IN_PROGRESS').length;

    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      totalItems: items.length,
      openItems: jobOpen,
      parties,
      unassignedTotal,
      unassignedOpen,
    });

    totalItems += items.length;
    totalOpen += jobOpen;
    totalUnassignedOpen += unassignedOpen;
  }

  // Sort rows: most open items first.
  rows.sort((a, b) => {
    if (a.openItems !== b.openItems) return b.openItems - a.openItems;
    return b.totalItems - a.totalItems;
  });

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalItems,
      totalOpen,
      totalUnassignedOpen,
    },
    rows,
  };
}

function canonicalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,'"`]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(llc|inc|incorporated|corp|corporation|co|company|ltd|limited)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function daysBetween(fromIso: string, toIso: string): number {
  const fromParts = fromIso.split('-').map((p) => Number.parseInt(p, 10));
  const toParts = toIso.split('-').map((p) => Number.parseInt(p, 10));
  const a = Date.UTC(fromParts[0] ?? 0, (fromParts[1] ?? 1) - 1, fromParts[2] ?? 1);
  const b = Date.UTC(toParts[0] ?? 0, (toParts[1] ?? 1) - 1, toParts[2] ?? 1);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}
