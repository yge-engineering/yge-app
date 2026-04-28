// Per-job RFI response-time histogram.
//
// Plain English: for each AWARDED job, look at every answered
// RFI and bucket the days from sentAt to answeredAt:
//   0-3, 4-7, 8-14, 15-30, 30+
//
// Per row: counts in each bucket, median + mean response days,
// answeredCount + openCount.
//
// Different from job-rfi-age (current open age),
// rfi-monthly-volume (time-series volume), and
// job-rfi-priority-mix (priority breakdown). This is the per-job
// engineer-responsiveness distribution.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { Rfi } from './rfi';

export interface RfiResponseHistogramRow {
  jobId: string;
  projectName: string;
  answeredCount: number;
  openCount: number;
  bucket0to3: number;
  bucket4to7: number;
  bucket8to14: number;
  bucket15to30: number;
  bucket30Plus: number;
  medianDays: number | null;
  meanDays: number | null;
  /** Slowest single response observed. Null if none. */
  maxDays: number | null;
}

export interface RfiResponseHistogramRollup {
  jobsConsidered: number;
  totalAnswered: number;
  totalOpen: number;
  blendedMedianDays: number | null;
}

export interface RfiResponseHistogramInputs {
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  rfis: Rfi[];
  /** Default false — only AWARDED jobs scored. */
  includeAllStatuses?: boolean;
}

export function buildJobRfiResponseHistogram(
  inputs: RfiResponseHistogramInputs,
): {
  rollup: RfiResponseHistogramRollup;
  rows: RfiResponseHistogramRow[];
} {
  const includeAll = inputs.includeAllStatuses === true;

  const byJob = new Map<string, Rfi[]>();
  for (const r of inputs.rfis) {
    const list = byJob.get(r.jobId) ?? [];
    list.push(r);
    byJob.set(r.jobId, list);
  }

  let totalAnswered = 0;
  let totalOpen = 0;
  const allDays: number[] = [];

  const rows: RfiResponseHistogramRow[] = [];
  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const rfis = byJob.get(j.id) ?? [];
    let b03 = 0;
    let b47 = 0;
    let b814 = 0;
    let b1530 = 0;
    let b30 = 0;
    let answered = 0;
    let open = 0;
    const days: number[] = [];

    for (const r of rfis) {
      const isOpen = r.status === 'DRAFT' || r.status === 'SENT';
      if (isOpen) {
        open += 1;
        continue;
      }
      if (!r.sentAt || !r.answeredAt) continue;
      const d = daysBetween(r.sentAt, r.answeredAt);
      if (d < 0) continue;
      answered += 1;
      days.push(d);
      allDays.push(d);
      if (d <= 3) b03 += 1;
      else if (d <= 7) b47 += 1;
      else if (d <= 14) b814 += 1;
      else if (d <= 30) b1530 += 1;
      else b30 += 1;
    }

    days.sort((a, b) => a - b);
    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      answeredCount: answered,
      openCount: open,
      bucket0to3: b03,
      bucket4to7: b47,
      bucket8to14: b814,
      bucket15to30: b1530,
      bucket30Plus: b30,
      medianDays: computeMedian(days),
      meanDays: days.length === 0
        ? null
        : Math.round((days.reduce((a, c) => a + c, 0) / days.length) * 10) / 10,
      maxDays: days.length === 0 ? null : (days[days.length - 1] ?? null),
    });

    totalAnswered += answered;
    totalOpen += open;
  }

  // Sort: highest median first (slowest responses), null medians at bottom.
  rows.sort((a, b) => {
    const am = a.medianDays;
    const bm = b.medianDays;
    if (am === null && bm === null) return 0;
    if (am === null) return 1;
    if (bm === null) return -1;
    return bm - am;
  });

  allDays.sort((a, b) => a - b);

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalAnswered,
      totalOpen,
      blendedMedianDays: computeMedian(allDays),
    },
    rows,
  };
}

function daysBetween(fromIso: string, toIso: string): number {
  const fromParts = fromIso.split('-').map((p) => Number.parseInt(p, 10));
  const toParts = toIso.split('-').map((p) => Number.parseInt(p, 10));
  const a = Date.UTC(fromParts[0] ?? 0, (fromParts[1] ?? 1) - 1, fromParts[2] ?? 1);
  const b = Date.UTC(toParts[0] ?? 0, (toParts[1] ?? 1) - 1, toParts[2] ?? 1);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? null;
  const a = sorted[mid - 1] ?? 0;
  const b = sorted[mid] ?? 0;
  return Math.round(((a + b) / 2) * 10) / 10;
}
