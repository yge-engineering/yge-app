// Job substantial-completion readiness check.
//
// Plain English: a job is ready for substantial completion when:
//   - zero open SAFETY punch items (Cal/OSHA blocker)
//   - zero open MAJOR punch items (contract blocker)
//   - zero open RFIs (no unanswered questions)
//   - zero submittals stuck in DRAFT / SUBMITTED / REVISE_RESUBMIT
//   - zero unexecuted PROPOSED/AGENCY_REVIEW/APPROVED COs that
//     would change scope before walkthrough
//
// MINOR punch items + WITHDRAWN/REJECTED items don't block; they're
// surfaced for visibility.
//
// Drives "can we call walkthrough yet?" — the question Brook asks
// once a week on every job in the closeout phase.
//
// Pure derivation. No persisted records.

import type { ChangeOrder } from './change-order';
import type { Job } from './job';
import type { PunchItem } from './punch-list';
import type { Rfi } from './rfi';
import type { Submittal } from './submittal';

export type ReadinessFlag =
  | 'READY'           // every blocker check is zero
  | 'CLOSE'           // 1-3 blockers across all categories
  | 'NOT_READY'       // 4+ blockers
  | 'NO_SCOPE';       // no closeout-phase data on this job (skip)

export interface ReadinessRow {
  jobId: string;
  projectName: string;
  openSafetyPunch: number;
  openMajorPunch: number;
  openMinorPunch: number;
  openRfis: number;
  pendingSubmittals: number;
  openCos: number;
  /** Sum of safety + major + rfis + pending submittals + open COs. */
  blockerCount: number;
  flag: ReadinessFlag;
}

export interface ReadinessRollup {
  jobsConsidered: number;
  ready: number;
  close: number;
  notReady: number;
  noScope: number;
  /** Total blockers across all considered jobs. */
  totalBlockers: number;
}

export interface ReadinessInputs {
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  punchItems: PunchItem[];
  rfis: Rfi[];
  submittals: Submittal[];
  changeOrders: ChangeOrder[];
  /** When false (default), only AWARDED jobs are considered. */
  includeAllStatuses?: boolean;
}

export function buildSubstantialCompletionReadiness(
  inputs: ReadinessInputs,
): {
  rollup: ReadinessRollup;
  rows: ReadinessRow[];
} {
  const includeAll = inputs.includeAllStatuses === true;

  const punchByJob = new Map<string, PunchItem[]>();
  for (const pi of inputs.punchItems) {
    if (pi.status === 'CLOSED' || pi.status === 'WAIVED') continue;
    const list = punchByJob.get(pi.jobId) ?? [];
    list.push(pi);
    punchByJob.set(pi.jobId, list);
  }

  const rfisByJob = new Map<string, Rfi[]>();
  for (const r of inputs.rfis) {
    if (r.status === 'CLOSED' || r.status === 'WITHDRAWN' || r.status === 'ANSWERED') continue;
    if (r.status === 'DRAFT') continue; // not yet open
    const list = rfisByJob.get(r.jobId) ?? [];
    list.push(r);
    rfisByJob.set(r.jobId, list);
  }

  const subsByJob = new Map<string, Submittal[]>();
  for (const s of inputs.submittals) {
    if (
      s.status === 'APPROVED' ||
      s.status === 'APPROVED_AS_NOTED' ||
      s.status === 'WITHDRAWN' ||
      s.status === 'REJECTED'
    ) continue;
    const list = subsByJob.get(s.jobId) ?? [];
    list.push(s);
    subsByJob.set(s.jobId, list);
  }

  const cosByJob = new Map<string, ChangeOrder[]>();
  for (const co of inputs.changeOrders) {
    if (co.status !== 'PROPOSED' && co.status !== 'AGENCY_REVIEW' && co.status !== 'APPROVED') continue;
    const list = cosByJob.get(co.jobId) ?? [];
    list.push(co);
    cosByJob.set(co.jobId, list);
  }

  const rows: ReadinessRow[] = [];
  const counts = { ready: 0, close: 0, notReady: 0, noScope: 0 };
  let totalBlockers = 0;

  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;

    const punches = punchByJob.get(j.id) ?? [];
    let safety = 0;
    let major = 0;
    let minor = 0;
    for (const p of punches) {
      if (p.severity === 'SAFETY') safety += 1;
      else if (p.severity === 'MAJOR') major += 1;
      else minor += 1;
    }
    const openRfis = (rfisByJob.get(j.id) ?? []).length;
    const pendingSubmittals = (subsByJob.get(j.id) ?? []).length;
    const openCos = (cosByJob.get(j.id) ?? []).length;

    const blockers = safety + major + openRfis + pendingSubmittals + openCos;
    const hasAnyData =
      punches.length > 0 ||
      openRfis > 0 ||
      pendingSubmittals > 0 ||
      openCos > 0;

    let flag: ReadinessFlag;
    if (!hasAnyData) flag = 'NO_SCOPE';
    else if (blockers === 0) flag = 'READY';
    else if (blockers <= 3) flag = 'CLOSE';
    else flag = 'NOT_READY';

    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      openSafetyPunch: safety,
      openMajorPunch: major,
      openMinorPunch: minor,
      openRfis,
      pendingSubmittals,
      openCos,
      blockerCount: blockers,
      flag,
    });

    if (flag === 'READY') counts.ready += 1;
    else if (flag === 'CLOSE') counts.close += 1;
    else if (flag === 'NOT_READY') counts.notReady += 1;
    else counts.noScope += 1;
    totalBlockers += blockers;
  }

  // READY first (good news up top), then CLOSE (chase these), then
  // NOT_READY, then NO_SCOPE pinned at bottom. Within tier, fewer
  // blockers first.
  const tierRank: Record<ReadinessFlag, number> = {
    READY: 0,
    CLOSE: 1,
    NOT_READY: 2,
    NO_SCOPE: 3,
  };
  rows.sort((a, b) => {
    if (a.flag !== b.flag) return tierRank[a.flag] - tierRank[b.flag];
    return a.blockerCount - b.blockerCount;
  });

  return {
    rollup: {
      jobsConsidered: rows.length,
      ready: counts.ready,
      close: counts.close,
      notReady: counts.notReady,
      noScope: counts.noScope,
      totalBlockers,
    },
    rows,
  };
}
