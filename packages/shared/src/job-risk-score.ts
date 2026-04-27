// Active job risk score composite.
//
// Plain English: every active job has a dozen signals — open
// punches, stale change orders, unanswered RFIs, dispatch
// coverage, schedule slip. Looking at each one separately is
// useful, but on a Monday morning Brook just wants ONE number
// per job that says "look here first." This module builds that
// score by tallying weighted signals into a 0-100 risk number,
// classifies it into a tier, and surfaces the top contributing
// signals so the row tells the story.
//
// Components (max points each):
//   safety punches         25  — Cal/OSHA blockers
//   stale open COs         20  — agency dragging, dollars in flight
//   unanswered RFIs >7d    20  — work blocked
//   dispatch dark          15  — job going dark
//   schedule slip          15  — past revised completion
//   stale punch (>30d)      5  — closeout stuck
//
// Pure derivation. No persisted records.

import type { ChangeOrder } from './change-order';
import type { DailyReport } from './daily-report';
import type { Dispatch } from './dispatch';
import type { Job } from './job';
import type { PunchItem } from './punch-list';
import type { Rfi } from './rfi';

export type JobRiskFlag =
  | 'GREEN'    // 0-15
  | 'YELLOW'   // 16-40
  | 'ORANGE'   // 41-65
  | 'RED';     // 66-100

export interface JobRiskComponent {
  name: string;
  points: number;
  detail: string;
}

export interface JobRiskRow {
  jobId: string;
  projectName: string;
  riskScore: number;
  flag: JobRiskFlag;
  /** Top 3 components driving the score, points desc. */
  topDrivers: JobRiskComponent[];
}

export interface JobRiskRollup {
  jobsConsidered: number;
  green: number;
  yellow: number;
  orange: number;
  red: number;
}

export interface JobRiskInputs {
  asOf?: string;
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  punchItems: PunchItem[];
  rfis: Rfi[];
  changeOrders: ChangeOrder[];
  dispatches: Dispatch[];
  dailyReports: DailyReport[];
  /** Map<jobId, original completion date>. Optional — when absent
   *  the schedule-slip component contributes 0. */
  originalCompletionByJobId?: Map<string, string>;
}

export function buildJobRiskScores(inputs: JobRiskInputs): {
  rollup: JobRiskRollup;
  rows: JobRiskRow[];
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const refNow = new Date(`${asOf}T00:00:00Z`);

  // Pre-aggregate by jobId.
  const punchesByJob = new Map<string, PunchItem[]>();
  for (const p of inputs.punchItems) {
    if (p.status === 'CLOSED' || p.status === 'WAIVED') continue;
    const list = punchesByJob.get(p.jobId) ?? [];
    list.push(p);
    punchesByJob.set(p.jobId, list);
  }
  const rfisByJob = new Map<string, Rfi[]>();
  for (const r of inputs.rfis) {
    if (r.status !== 'SENT') continue;
    const list = rfisByJob.get(r.jobId) ?? [];
    list.push(r);
    rfisByJob.set(r.jobId, list);
  }
  const cosByJob = new Map<string, ChangeOrder[]>();
  for (const co of inputs.changeOrders) {
    if (co.status !== 'PROPOSED' && co.status !== 'AGENCY_REVIEW' && co.status !== 'APPROVED') continue;
    const list = cosByJob.get(co.jobId) ?? [];
    list.push(co);
    cosByJob.set(co.jobId, list);
  }
  const lastDispatchByJob = new Map<string, string>();
  for (const d of inputs.dispatches) {
    if (d.status !== 'POSTED' && d.status !== 'COMPLETED') continue;
    const cur = lastDispatchByJob.get(d.jobId);
    if (!cur || d.scheduledFor > cur) lastDispatchByJob.set(d.jobId, d.scheduledFor);
  }
  const lastDrByJob = new Map<string, string>();
  for (const dr of inputs.dailyReports) {
    if (!dr.submitted) continue;
    const cur = lastDrByJob.get(dr.jobId);
    if (!cur || dr.date > cur) lastDrByJob.set(dr.jobId, dr.date);
  }

  const rows: JobRiskRow[] = [];
  const counts = { green: 0, yellow: 0, orange: 0, red: 0 };

  for (const j of inputs.jobs) {
    if (j.status !== 'AWARDED') continue;
    const components: JobRiskComponent[] = [];

    // 1. Safety punches: 25 points if any open SAFETY items.
    const punches = punchesByJob.get(j.id) ?? [];
    const safetyOpen = punches.filter((p) => p.severity === 'SAFETY').length;
    if (safetyOpen > 0) {
      components.push({
        name: 'safety punches',
        points: Math.min(25, safetyOpen * 10),
        detail: `${safetyOpen} open`,
      });
    }

    // 2. Stale open COs (>30 days waiting): 20 max.
    const cos = cosByJob.get(j.id) ?? [];
    const staleCos = cos.filter((co) => {
      if (!co.proposedAt) return false;
      const propDate = parseDate(co.proposedAt);
      if (!propDate) return false;
      return daysBetween(propDate, refNow) >= 30;
    }).length;
    if (staleCos > 0) {
      components.push({
        name: 'stale open COs',
        points: Math.min(20, staleCos * 7),
        detail: `${staleCos} >30d`,
      });
    }

    // 3. Unanswered RFIs > 7 days: 20 max.
    const rfis = rfisByJob.get(j.id) ?? [];
    const oldRfis = rfis.filter((r) => {
      const updated = parseIsoDate(r.updatedAt);
      if (!updated) return false;
      return daysBetween(updated, refNow) > 7;
    }).length;
    if (oldRfis > 0) {
      components.push({
        name: 'unanswered RFIs',
        points: Math.min(20, oldRfis * 5),
        detail: `${oldRfis} >7d`,
      });
    }

    // 4. Dispatch dark (no POSTED dispatch in 14+ days): 15.
    const lastDispatch = lastDispatchByJob.get(j.id);
    if (!lastDispatch) {
      components.push({
        name: 'no dispatch in window',
        points: 10,
        detail: 'never dispatched',
      });
    } else {
      const lastDate = parseDate(lastDispatch);
      if (lastDate) {
        const daysSince = daysBetween(lastDate, refNow);
        if (daysSince > 14) {
          components.push({
            name: 'dispatch dark',
            points: 15,
            detail: `${daysSince}d since last`,
          });
        } else if (daysSince > 7) {
          components.push({
            name: 'dispatch quiet',
            points: 7,
            detail: `${daysSince}d since last`,
          });
        }
      }
    }

    // 5. Schedule slip: 15 max if past revised completion.
    const original = inputs.originalCompletionByJobId?.get(j.id);
    if (original) {
      const origDate = parseDate(original);
      if (origDate) {
        const executedScheduleDays = inputs.changeOrders
          .filter((co) => co.jobId === j.id && co.status === 'EXECUTED')
          .reduce((acc, co) => acc + co.totalScheduleImpactDays, 0);
        const revised = new Date(origDate.getTime() + executedScheduleDays * 24 * 60 * 60 * 1000);
        const daysPast = daysBetween(revised, refNow);
        if (daysPast > 30) {
          components.push({ name: 'schedule slip', points: 15, detail: `${daysPast}d past revised` });
        } else if (daysPast > 0) {
          components.push({ name: 'schedule slip', points: 8, detail: `${daysPast}d past revised` });
        }
      }
    }

    // 6. Stale punch (>30 days open): 5.
    const stalePunches = punches.filter((p) => {
      const idDate = parseDate(p.identifiedOn);
      if (!idDate) return false;
      return daysBetween(idDate, refNow) >= 30;
    }).length;
    if (stalePunches > 0) {
      components.push({
        name: 'stale punches',
        points: Math.min(5, stalePunches * 2),
        detail: `${stalePunches} >30d`,
      });
    }

    const score = Math.min(
      100,
      components.reduce((acc, c) => acc + c.points, 0),
    );
    const flag = classify(score);
    const topDrivers = [...components]
      .sort((a, b) => b.points - a.points)
      .slice(0, 3);

    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      riskScore: score,
      flag,
      topDrivers,
    });
    if (flag === 'GREEN') counts.green += 1;
    else if (flag === 'YELLOW') counts.yellow += 1;
    else if (flag === 'ORANGE') counts.orange += 1;
    else counts.red += 1;
  }

  // Highest risk first.
  rows.sort((a, b) => b.riskScore - a.riskScore);

  return {
    rollup: {
      jobsConsidered: rows.length,
      green: counts.green,
      yellow: counts.yellow,
      orange: counts.orange,
      red: counts.red,
    },
    rows,
  };
}

function classify(score: number): JobRiskFlag {
  if (score <= 15) return 'GREEN';
  if (score <= 40) return 'YELLOW';
  if (score <= 65) return 'ORANGE';
  return 'RED';
}

function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseIsoDate(s: string): Date | null {
  return parseDate(s.slice(0, 10));
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}
