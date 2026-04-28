// Per-job RFI impact summary.
//
// Plain English: across the RFIs we've gotten answers to,
// how many actually changed the price or the schedule? Jobs
// where most RFIs come back with cost or schedule impact are
// jobs where the design has gaps — and that's where the next
// pursuit's contingency line should come from.
//
// Per row: jobId, rfisConsidered, costImpactCount,
// scheduleImpactCount, bothImpactCount, noImpactCount,
// costImpactRate, scheduleImpactRate. Sort by costImpactCount
// desc, ties by scheduleImpactCount desc.
//
// "Considered" = RFI is in ANSWERED or CLOSED status. Drafts,
// sent-but-pending, and withdrawn RFIs are skipped — we only
// score outcomes the agency actually weighed in on.
//
// Different from job-rfi-priority-mix (priority breakdown),
// job-rfi-to-co (RFI → CO conversion), and job-rfi-response-
// histogram (response-time distribution). This is the
// "did the answer hurt us" view.
//
// Pure derivation. No persisted records.

import type { Rfi } from './rfi';

export interface JobRfiImpactRow {
  jobId: string;
  rfisConsidered: number;
  costImpactCount: number;
  scheduleImpactCount: number;
  bothImpactCount: number;
  noImpactCount: number;
  costImpactRate: number;
  scheduleImpactRate: number;
}

export interface JobRfiImpactRollup {
  jobsConsidered: number;
  rfisConsidered: number;
  costImpactCount: number;
  scheduleImpactCount: number;
  portfolioCostImpactRate: number;
  portfolioScheduleImpactRate: number;
}

export interface JobRfiImpactInputs {
  rfis: Rfi[];
  /** Optional yyyy-mm-dd window applied to answeredAt. */
  fromDate?: string;
  toDate?: string;
}

export function buildJobRfiImpactSummary(
  inputs: JobRfiImpactInputs,
): {
  rollup: JobRfiImpactRollup;
  rows: JobRfiImpactRow[];
} {
  type Acc = {
    jobId: string;
    considered: number;
    cost: number;
    schedule: number;
    both: number;
    neither: number;
  };
  const accs = new Map<string, Acc>();

  for (const r of inputs.rfis) {
    if (r.status !== 'ANSWERED' && r.status !== 'CLOSED') continue;
    if (inputs.fromDate && r.answeredAt && r.answeredAt < inputs.fromDate) continue;
    if (inputs.toDate && r.answeredAt && r.answeredAt > inputs.toDate) continue;
    const acc = accs.get(r.jobId) ?? {
      jobId: r.jobId,
      considered: 0,
      cost: 0,
      schedule: 0,
      both: 0,
      neither: 0,
    };
    acc.considered += 1;
    if (r.costImpact) acc.cost += 1;
    if (r.scheduleImpact) acc.schedule += 1;
    if (r.costImpact && r.scheduleImpact) acc.both += 1;
    if (!r.costImpact && !r.scheduleImpact) acc.neither += 1;
    accs.set(r.jobId, acc);
  }

  const rows: JobRfiImpactRow[] = [];
  let totalConsidered = 0;
  let totalCost = 0;
  let totalSchedule = 0;

  for (const acc of accs.values()) {
    const costRate = acc.considered === 0
      ? 0
      : Math.round((acc.cost / acc.considered) * 10_000) / 10_000;
    const schedRate = acc.considered === 0
      ? 0
      : Math.round((acc.schedule / acc.considered) * 10_000) / 10_000;
    rows.push({
      jobId: acc.jobId,
      rfisConsidered: acc.considered,
      costImpactCount: acc.cost,
      scheduleImpactCount: acc.schedule,
      bothImpactCount: acc.both,
      noImpactCount: acc.neither,
      costImpactRate: costRate,
      scheduleImpactRate: schedRate,
    });
    totalConsidered += acc.considered;
    totalCost += acc.cost;
    totalSchedule += acc.schedule;
  }

  rows.sort((a, b) => {
    if (b.costImpactCount !== a.costImpactCount) {
      return b.costImpactCount - a.costImpactCount;
    }
    return b.scheduleImpactCount - a.scheduleImpactCount;
  });

  const portfolioCostRate = totalConsidered === 0
    ? 0
    : Math.round((totalCost / totalConsidered) * 10_000) / 10_000;
  const portfolioSchedRate = totalConsidered === 0
    ? 0
    : Math.round((totalSchedule / totalConsidered) * 10_000) / 10_000;

  return {
    rollup: {
      jobsConsidered: rows.length,
      rfisConsidered: totalConsidered,
      costImpactCount: totalCost,
      scheduleImpactCount: totalSchedule,
      portfolioCostImpactRate: portfolioCostRate,
      portfolioScheduleImpactRate: portfolioSchedRate,
    },
    rows,
  };
}
