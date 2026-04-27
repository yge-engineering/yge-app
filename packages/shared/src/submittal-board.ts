// Cross-job submittal status board.
//
// Plain English: project managers ask "what submittals are open right
// now and which ones is the engineer late on?" This rolls every open
// submittal across every job into one urgency-sorted dashboard.
//
// Pure derivation. No persisted records.
//
// Status semantics:
//   - 'DRAFT' / 'WITHDRAWN' — not in the report (not actually pending).
//   - 'APPROVED' / 'APPROVED_AS_NOTED' / 'REJECTED' — closed, also not
//     in the report.
//   - 'SUBMITTED' — waiting on engineer. URGENT if past responseDueAt.
//   - 'REVISE_RESUBMIT' — back on YGE's desk; needs revision and
//     resubmission. Has no response-due-date — the urgency comes
//     from blocksOrdering + lead-time text.

import type { Submittal, SubmittalStatus } from './submittal';

export type SubmittalBoardUrgency =
  | 'CRITICAL'   // overdue + blocksOrdering, OR overdue >14 days
  | 'OVERDUE'    // past responseDueAt
  | 'DUE_SOON'   // within 5 days of responseDueAt
  | 'PENDING'    // submitted, not yet near due
  | 'REVISE'     // back on us
  | 'CLOSED';    // approved / rejected / withdrawn — usually filtered out

export interface SubmittalBoardRow {
  id: string;
  jobId: string;
  /** Job display name when caller provides the lookup. Falls back to
   *  jobId. */
  projectName: string;

  submittalNumber: string;
  revision?: string;
  specSection?: string;
  subject: string;
  kind: Submittal['kind'];
  status: SubmittalStatus;

  submittedTo?: string;
  submittedAt?: string;
  responseDueAt?: string;
  /** Negative = past due. Null when no responseDueAt. */
  daysToDue: number | null;
  blocksOrdering: boolean;
  leadTimeNote?: string;

  urgency: SubmittalBoardUrgency;
}

export interface SubmittalBoardRollup {
  total: number;
  critical: number;
  overdue: number;
  dueSoon: number;
  pending: number;
  blocksOrderingCount: number;
}

export interface SubmittalBoardInputs {
  /** ISO yyyy-mm-dd; defaults to today (UTC). */
  asOf?: string;
  submittals: Submittal[];
  /** Optional jobId → projectName lookup so rows print a friendly name. */
  jobNamesById?: Map<string, string>;
  /** When true, include closed submittals (APPROVED / REJECTED /
   *  WITHDRAWN) at the bottom of the list. Default: false. */
  includeClosed?: boolean;
}

export function buildSubmittalBoard(inputs: SubmittalBoardInputs): {
  rows: SubmittalBoardRow[];
  rollup: SubmittalBoardRollup;
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const jobNamesById = inputs.jobNamesById;
  const includeClosed = inputs.includeClosed === true;

  const rows: SubmittalBoardRow[] = [];

  for (const s of inputs.submittals) {
    const isClosed =
      s.status === 'APPROVED' ||
      s.status === 'APPROVED_AS_NOTED' ||
      s.status === 'REJECTED' ||
      s.status === 'WITHDRAWN' ||
      s.status === 'DRAFT';
    if (isClosed && !includeClosed) continue;

    const daysToDue =
      s.responseDueAt && /^\d{4}-\d{2}-\d{2}$/.test(s.responseDueAt)
        ? daysBetween(asOf, s.responseDueAt)
        : null;

    const urgency = computeUrgency(s.status, daysToDue, s.blocksOrdering);

    rows.push({
      id: s.id,
      jobId: s.jobId,
      projectName: jobNamesById?.get(s.jobId) ?? s.jobId,
      submittalNumber: s.submittalNumber,
      revision: s.revision,
      specSection: s.specSection,
      subject: s.subject,
      kind: s.kind,
      status: s.status,
      submittedTo: s.submittedTo,
      submittedAt: s.submittedAt,
      responseDueAt: s.responseDueAt,
      daysToDue,
      blocksOrdering: s.blocksOrdering,
      leadTimeNote: s.leadTimeNote,
      urgency,
    });
  }

  // Most urgent first. Within urgency tier: blocksOrdering first,
  // then most-overdue (smallest daysToDue) first.
  const tierRank: Record<SubmittalBoardUrgency, number> = {
    CRITICAL: 0,
    OVERDUE: 1,
    DUE_SOON: 2,
    REVISE: 3,
    PENDING: 4,
    CLOSED: 5,
  };
  rows.sort((a, b) => {
    if (a.urgency !== b.urgency) {
      return tierRank[a.urgency] - tierRank[b.urgency];
    }
    if (a.blocksOrdering !== b.blocksOrdering) {
      return a.blocksOrdering ? -1 : 1;
    }
    const ad = a.daysToDue ?? Number.POSITIVE_INFINITY;
    const bd = b.daysToDue ?? Number.POSITIVE_INFINITY;
    return ad - bd;
  });

  let critical = 0;
  let overdue = 0;
  let dueSoon = 0;
  let pending = 0;
  let blocksOrderingCount = 0;
  for (const r of rows) {
    if (r.urgency === 'CRITICAL') critical += 1;
    else if (r.urgency === 'OVERDUE') overdue += 1;
    else if (r.urgency === 'DUE_SOON') dueSoon += 1;
    else if (r.urgency === 'PENDING' || r.urgency === 'REVISE') pending += 1;
    if (r.blocksOrdering) blocksOrderingCount += 1;
  }

  return {
    rows,
    rollup: {
      total: rows.length,
      critical,
      overdue,
      dueSoon,
      pending,
      blocksOrderingCount,
    },
  };
}

function computeUrgency(
  status: SubmittalStatus,
  daysToDue: number | null,
  blocksOrdering: boolean,
): SubmittalBoardUrgency {
  if (
    status === 'APPROVED' ||
    status === 'APPROVED_AS_NOTED' ||
    status === 'REJECTED' ||
    status === 'WITHDRAWN'
  ) {
    return 'CLOSED';
  }
  if (status === 'DRAFT') return 'CLOSED';
  if (status === 'REVISE_RESUBMIT') return 'REVISE';

  // SUBMITTED — waiting on engineer.
  if (daysToDue == null) return 'PENDING';
  if (daysToDue < 0) {
    // Overdue.
    if (blocksOrdering || daysToDue <= -14) return 'CRITICAL';
    return 'OVERDUE';
  }
  if (daysToDue <= 5) return 'DUE_SOON';
  return 'PENDING';
}

/** Calendar days between two yyyy-mm-dd strings, signed.
 *  Positive = `to` is in the future relative to `from`. UTC math. */
function daysBetween(from: string, to: string): number {
  const f = Date.parse(`${from}T00:00:00Z`);
  const t = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(f) || Number.isNaN(t)) return 0;
  return Math.round((t - f) / (24 * 60 * 60 * 1000));
}
