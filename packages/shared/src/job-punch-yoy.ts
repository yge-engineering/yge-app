// Job-anchored punch-list year-over-year.
//
// Plain English: for one job, collapse two years of punch
// items into a comparison: counts, open vs closed, status +
// severity mix, plus deltas.
//
// Pure derivation. No persisted records.

import type { PunchItem, PunchItemSeverity, PunchItemStatus } from './punch-list';

export interface JobPunchYoyResult {
  jobId: string;
  priorYear: number;
  currentYear: number;
  priorTotal: number;
  priorOpen: number;
  priorClosed: number;
  priorByStatus: Partial<Record<PunchItemStatus, number>>;
  priorBySeverity: Partial<Record<PunchItemSeverity, number>>;
  currentTotal: number;
  currentOpen: number;
  currentClosed: number;
  currentByStatus: Partial<Record<PunchItemStatus, number>>;
  currentBySeverity: Partial<Record<PunchItemSeverity, number>>;
  totalDelta: number;
}

export interface JobPunchYoyInputs {
  jobId: string;
  punchItems: PunchItem[];
  currentYear: number;
}

export function buildJobPunchYoy(inputs: JobPunchYoyInputs): JobPunchYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    total: number;
    open: number;
    closed: number;
    byStatus: Map<PunchItemStatus, number>;
    bySeverity: Map<PunchItemSeverity, number>;
  };
  function emptyBucket(): Bucket {
    return { total: 0, open: 0, closed: 0, byStatus: new Map(), bySeverity: new Map() };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const p of inputs.punchItems) {
    if (p.jobId !== inputs.jobId) continue;
    const dt = p.identifiedOn;
    if (!dt) continue;
    const year = Number(dt.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.total += 1;
    b.byStatus.set(p.status, (b.byStatus.get(p.status) ?? 0) + 1);
    b.bySeverity.set(p.severity, (b.bySeverity.get(p.severity) ?? 0) + 1);
    const isOpen = p.status === 'OPEN' || p.status === 'IN_PROGRESS' || p.status === 'DISPUTED';
    if (isOpen) b.open += 1;
    else b.closed += 1;
  }

  function statusRecord(m: Map<PunchItemStatus, number>): Partial<Record<PunchItemStatus, number>> {
    const out: Partial<Record<PunchItemStatus, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }
  function sevRecord(m: Map<PunchItemSeverity, number>): Partial<Record<PunchItemSeverity, number>> {
    const out: Partial<Record<PunchItemSeverity, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    jobId: inputs.jobId,
    priorYear,
    currentYear: inputs.currentYear,
    priorTotal: prior.total,
    priorOpen: prior.open,
    priorClosed: prior.closed,
    priorByStatus: statusRecord(prior.byStatus),
    priorBySeverity: sevRecord(prior.bySeverity),
    currentTotal: current.total,
    currentOpen: current.open,
    currentClosed: current.closed,
    currentByStatus: statusRecord(current.byStatus),
    currentBySeverity: sevRecord(current.bySeverity),
    totalDelta: current.total - prior.total,
  };
}
