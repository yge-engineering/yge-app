// Cross-job open-RFI dashboard.
//
// Plain English: every active job has a pile of RFIs in flight at
// any given moment. They land at different urgencies and different
// engineers move at different speeds. The PM wants one screen
// showing "what's open, what's overdue, what's blocking work" so
// nothing slips between jobs.
//
// Pure derivation. No persisted records.

import type { Rfi, RfiPriority, RfiStatus } from './rfi';

export type RfiBoardUrgency =
  | 'CRITICAL'    // overdue + (cost or schedule impact) OR overdue >14d OR priority=CRITICAL
  | 'OVERDUE'     // past responseDueAt
  | 'DUE_SOON'    // within 5 days of responseDueAt
  | 'PENDING'     // sent, not yet near due
  | 'DRAFT';      // not yet sent

export interface RfiBoardRow {
  id: string;
  jobId: string;
  rfiNumber: string;
  subject: string;
  status: RfiStatus;
  priority: RfiPriority;
  askedOf?: string;
  sentAt?: string;
  responseDueAt?: string;
  daysToDue: number | null;
  costImpact: boolean;
  scheduleImpact: boolean;
  urgency: RfiBoardUrgency;
}

export interface RfiBoardRollup {
  total: number;
  critical: number;
  overdue: number;
  dueSoon: number;
  pending: number;
  draft: number;
  /** Number of open RFIs flagged as cost OR schedule impact. */
  withImpact: number;
}

export interface RfiBoardInputs {
  /** ISO yyyy-mm-dd; defaults to today (UTC). */
  asOf?: string;
  rfis: Rfi[];
  /** When true, include ANSWERED + CLOSED + WITHDRAWN at the bottom.
   *  Default false (only DRAFT + SENT). */
  includeResolved?: boolean;
}

export function buildRfiBoard(inputs: RfiBoardInputs): {
  rows: RfiBoardRow[];
  rollup: RfiBoardRollup;
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const includeResolved = inputs.includeResolved === true;

  const rows: RfiBoardRow[] = [];
  for (const r of inputs.rfis) {
    const isOpen = r.status === 'DRAFT' || r.status === 'SENT';
    if (!isOpen && !includeResolved) continue;

    const daysToDue =
      r.responseDueAt && /^\d{4}-\d{2}-\d{2}$/.test(r.responseDueAt)
        ? daysBetween(asOf, r.responseDueAt)
        : null;

    let urgency: RfiBoardUrgency;
    if (r.status === 'DRAFT') {
      urgency = 'DRAFT';
    } else if (
      (daysToDue != null && daysToDue < 0 && (r.costImpact || r.scheduleImpact)) ||
      (daysToDue != null && daysToDue <= -14) ||
      r.priority === 'CRITICAL'
    ) {
      urgency = 'CRITICAL';
    } else if (daysToDue != null && daysToDue < 0) {
      urgency = 'OVERDUE';
    } else if (daysToDue != null && daysToDue <= 5) {
      urgency = 'DUE_SOON';
    } else {
      urgency = 'PENDING';
    }

    rows.push({
      id: r.id,
      jobId: r.jobId,
      rfiNumber: r.rfiNumber,
      subject: r.subject,
      status: r.status,
      priority: r.priority,
      askedOf: r.askedOf,
      sentAt: r.sentAt,
      responseDueAt: r.responseDueAt,
      daysToDue,
      costImpact: r.costImpact,
      scheduleImpact: r.scheduleImpact,
      urgency,
    });
  }

  const tierRank: Record<RfiBoardUrgency, number> = {
    CRITICAL: 0,
    OVERDUE: 1,
    DUE_SOON: 2,
    PENDING: 3,
    DRAFT: 4,
  };
  rows.sort((a, b) => {
    if (a.urgency !== b.urgency) return tierRank[a.urgency] - tierRank[b.urgency];
    const ad = a.daysToDue ?? Number.POSITIVE_INFINITY;
    const bd = b.daysToDue ?? Number.POSITIVE_INFINITY;
    return ad - bd;
  });

  let critical = 0;
  let overdue = 0;
  let dueSoon = 0;
  let pending = 0;
  let draft = 0;
  let withImpact = 0;
  for (const r of rows) {
    if (r.urgency === 'CRITICAL') critical += 1;
    else if (r.urgency === 'OVERDUE') overdue += 1;
    else if (r.urgency === 'DUE_SOON') dueSoon += 1;
    else if (r.urgency === 'PENDING') pending += 1;
    else draft += 1;
    if (r.costImpact || r.scheduleImpact) withImpact += 1;
  }

  return {
    rows,
    rollup: {
      total: rows.length,
      critical,
      overdue,
      dueSoon,
      pending,
      draft,
      withImpact,
    },
  };
}

function daysBetween(from: string, to: string): number {
  const f = Date.parse(`${from}T00:00:00Z`);
  const t = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(f) || Number.isNaN(t)) return 0;
  return Math.round((t - f) / (24 * 60 * 60 * 1000));
}
