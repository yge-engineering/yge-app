// Job schedule slip tracker.
//
// Plain English: every contract has an original completion date.
// Every executed change order can carry schedule-day extensions
// (most COs add days; some occasionally accelerate). Where does
// that leave each active job? Original date plus net executed
// schedule days = revised date. If revised is past today, the job
// is in slip territory.
//
// Pure derivation. No persisted records.

import type { ChangeOrder } from './change-order';
import type { Job } from './job';

export type ScheduleSlipFlag =
  | 'ON_TIME'        // revised completion is in the future
  | 'AT_RISK'        // within 14 days of revised completion
  | 'SLIPPING'       // 1-30 days past revised completion
  | 'SEVERE'         // 31+ days past revised completion
  | 'NO_DATE';       // no original completion date supplied

export interface JobScheduleSlipRow {
  jobId: string;
  projectName: string;
  originalCompletionDate: string | null;
  /** Sum of totalScheduleImpactDays across EXECUTED COs. */
  netScheduleDaysAdded: number;
  /** original + netScheduleDaysAdded. Null when no original. */
  revisedCompletionDate: string | null;
  /** Days from asOf to revisedCompletionDate. Negative = past due. */
  daysToRevisedCompletion: number | null;
  flag: ScheduleSlipFlag;
  /** Count of executed COs that touched the schedule. */
  scheduleAdjustingCoCount: number;
}

export interface JobScheduleSlipRollup {
  jobsConsidered: number;
  onTime: number;
  atRisk: number;
  slipping: number;
  severe: number;
  noDate: number;
  /** Total executed schedule days added across all jobs. */
  totalScheduleDaysAdded: number;
}

export interface JobScheduleSlipInputs {
  asOf?: string;
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  changeOrders: ChangeOrder[];
  /** Map<jobId, original completion date yyyy-mm-dd>. */
  originalCompletionByJobId: Map<string, string>;
  /** When false (default), only includes AWARDED jobs. */
  includeAllStatuses?: boolean;
}

export function buildJobScheduleSlip(inputs: JobScheduleSlipInputs): {
  rollup: JobScheduleSlipRollup;
  rows: JobScheduleSlipRow[];
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const refNow = new Date(`${asOf}T00:00:00Z`);
  const includeAll = inputs.includeAllStatuses === true;

  const cosByJob = new Map<string, ChangeOrder[]>();
  for (const co of inputs.changeOrders) {
    if (co.status !== 'EXECUTED') continue;
    const list = cosByJob.get(co.jobId) ?? [];
    list.push(co);
    cosByJob.set(co.jobId, list);
  }

  const rows: JobScheduleSlipRow[] = [];
  const counts = { onTime: 0, atRisk: 0, slipping: 0, severe: 0, noDate: 0 };
  let totalDaysAdded = 0;

  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;

    const cos = cosByJob.get(j.id) ?? [];
    let netDays = 0;
    let scheduleAdjustingCount = 0;
    for (const co of cos) {
      if (co.totalScheduleImpactDays !== 0) {
        netDays += co.totalScheduleImpactDays;
        scheduleAdjustingCount += 1;
      }
    }

    const original = inputs.originalCompletionByJobId.get(j.id) ?? null;
    let revised: string | null = null;
    let daysToRevised: number | null = null;
    let flag: ScheduleSlipFlag;

    if (!original) {
      flag = 'NO_DATE';
    } else {
      const origDate = parseDate(original);
      if (!origDate) {
        flag = 'NO_DATE';
      } else {
        const revisedDate = new Date(
          origDate.getTime() + netDays * 24 * 60 * 60 * 1000,
        );
        revised = isoDate(revisedDate);
        daysToRevised = daysBetween(refNow, revisedDate);
        if (daysToRevised < -30) flag = 'SEVERE';
        else if (daysToRevised < 0) flag = 'SLIPPING';
        else if (daysToRevised <= 14) flag = 'AT_RISK';
        else flag = 'ON_TIME';
      }
    }

    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      originalCompletionDate: original,
      netScheduleDaysAdded: netDays,
      revisedCompletionDate: revised,
      daysToRevisedCompletion: daysToRevised,
      flag,
      scheduleAdjustingCoCount: scheduleAdjustingCount,
    });

    if (flag === 'ON_TIME') counts.onTime += 1;
    else if (flag === 'AT_RISK') counts.atRisk += 1;
    else if (flag === 'SLIPPING') counts.slipping += 1;
    else if (flag === 'SEVERE') counts.severe += 1;
    else counts.noDate += 1;
    totalDaysAdded += netDays;
  }

  // Worst-slip first (most negative daysToRevised), NO_DATE pinned at bottom.
  const tierRank: Record<ScheduleSlipFlag, number> = {
    SEVERE: 0,
    SLIPPING: 1,
    AT_RISK: 2,
    ON_TIME: 3,
    NO_DATE: 4,
  };
  rows.sort((a, b) => {
    if (a.flag !== b.flag) return tierRank[a.flag] - tierRank[b.flag];
    if (a.daysToRevisedCompletion === null) return 1;
    if (b.daysToRevisedCompletion === null) return -1;
    return a.daysToRevisedCompletion - b.daysToRevisedCompletion;
  });

  return {
    rollup: {
      jobsConsidered: rows.length,
      onTime: counts.onTime,
      atRisk: counts.atRisk,
      slipping: counts.slipping,
      severe: counts.severe,
      noDate: counts.noDate,
      totalScheduleDaysAdded: totalDaysAdded,
    },
    rows,
  };
}

function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}
