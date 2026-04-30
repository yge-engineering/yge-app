// Customer-anchored punch-list year-over-year.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// collapse two years of punch items into a comparison: counts,
// open vs closed, status + severity mix, distinct jobs, plus
// deltas. Items roll into the year of identifiedOn.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { PunchItem, PunchItemSeverity, PunchItemStatus } from './punch-list';

export interface CustomerPunchYoyResult {
  customerName: string;
  priorYear: number;
  currentYear: number;
  priorTotal: number;
  priorOpen: number;
  priorClosed: number;
  priorByStatus: Partial<Record<PunchItemStatus, number>>;
  priorBySeverity: Partial<Record<PunchItemSeverity, number>>;
  priorDistinctJobs: number;
  currentTotal: number;
  currentOpen: number;
  currentClosed: number;
  currentByStatus: Partial<Record<PunchItemStatus, number>>;
  currentBySeverity: Partial<Record<PunchItemSeverity, number>>;
  currentDistinctJobs: number;
  totalDelta: number;
}

export interface CustomerPunchYoyInputs {
  customerName: string;
  punchItems: PunchItem[];
  jobs: Job[];
  currentYear: number;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildCustomerPunchYoy(
  inputs: CustomerPunchYoyInputs,
): CustomerPunchYoyResult {
  const priorYear = inputs.currentYear - 1;
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Bucket = {
    total: number;
    open: number;
    closed: number;
    byStatus: Map<PunchItemStatus, number>;
    bySeverity: Map<PunchItemSeverity, number>;
    jobs: Set<string>;
  };
  function emptyBucket(): Bucket {
    return { total: 0, open: 0, closed: 0, byStatus: new Map(), bySeverity: new Map(), jobs: new Set() };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const p of inputs.punchItems) {
    if (!customerJobs.has(p.jobId)) continue;
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
    b.jobs.add(p.jobId);
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
    customerName: inputs.customerName,
    priorYear,
    currentYear: inputs.currentYear,
    priorTotal: prior.total,
    priorOpen: prior.open,
    priorClosed: prior.closed,
    priorByStatus: statusRecord(prior.byStatus),
    priorBySeverity: sevRecord(prior.bySeverity),
    priorDistinctJobs: prior.jobs.size,
    currentTotal: current.total,
    currentOpen: current.open,
    currentClosed: current.closed,
    currentByStatus: statusRecord(current.byStatus),
    currentBySeverity: sevRecord(current.bySeverity),
    currentDistinctJobs: current.jobs.size,
    totalDelta: current.total - prior.total,
  };
}
