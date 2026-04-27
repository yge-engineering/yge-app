// Foreman scorecard.
//
// Plain English: each foreman submits one daily report per crew per
// day. Some get the report in same-day (good — owners and accounting
// see real-time progress). Some are 3 days behind (bad — every late
// DR is a billing risk on §20104.50 prompt-pay clocks and a hole in
// the §1509 toolbox-talk record). Some never include photos (also
// bad — photo evidence is what defends a differing-site claim).
//
// This rolls up DR + photo behavior per foreman and surfaces:
//   - DRs filed in window
//   - same-day vs 1-day vs late submission rates
//   - average photos per DR
//   - average crew-hours captured per DR
//
// Pure derivation. Range filter optional.

import type { DailyReport } from './daily-report';
import { crewRowWorkedMinutes } from './daily-report';

export interface ForemanScorecardRow {
  foremanId: string;
  drsSubmitted: number;
  /** drsSubmitted, broken down by lateness bucket. */
  sameDayCount: number;        // submitted on the same calendar day
  oneDayLateCount: number;     // submitted 1 day after
  twoDayLateCount: number;     // 2 days after
  threePlusLateCount: number;  // 3+ days late
  /** drsSubmitted as a share of (drsSubmitted + draftCount). */
  submissionRate: number;
  draftCount: number;
  /** Average photo count across submitted DRs (0 = none). */
  avgPhotos: number;
  /** Average crew-on-site rows per submitted DR. */
  avgCrewSize: number;
  /** Average worked hours per DR (sum across crew rows / DR count). */
  avgWorkedHours: number;
  /** Total photos contributed across submitted DRs. */
  totalPhotos: number;
  /** Distinct jobs the foreman ran. */
  distinctJobs: number;
}

export interface ForemanScorecardRollup {
  foremen: number;
  totalDrs: number;
  totalDrafts: number;
  totalPhotos: number;
  /** Foremen with > 25% of submissions filed 2+ days late. */
  laggingForemen: number;
}

export interface ForemanScorecardInputs {
  /** Optional yyyy-mm-dd inclusive bounds. */
  fromDate?: string;
  toDate?: string;
  dailyReports: DailyReport[];
}

export function buildForemanScorecard(inputs: ForemanScorecardInputs): {
  rollup: ForemanScorecardRollup;
  rows: ForemanScorecardRow[];
} {
  type Bucket = {
    foremanId: string;
    submitted: number;
    drafts: number;
    sameDay: number;
    oneDay: number;
    twoDay: number;
    threePlus: number;
    photos: number;
    crewRows: number;
    workedMinutes: number;
    jobs: Set<string>;
  };
  const buckets = new Map<string, Bucket>();
  const inRange = (d: string) => {
    if (inputs.fromDate && d < inputs.fromDate) return false;
    if (inputs.toDate && d > inputs.toDate) return false;
    return true;
  };

  for (const dr of inputs.dailyReports) {
    if (!inRange(dr.date)) continue;
    const b = buckets.get(dr.foremanId) ?? {
      foremanId: dr.foremanId,
      submitted: 0,
      drafts: 0,
      sameDay: 0,
      oneDay: 0,
      twoDay: 0,
      threePlus: 0,
      photos: 0,
      crewRows: 0,
      workedMinutes: 0,
      jobs: new Set<string>(),
    };

    if (!dr.submitted) {
      b.drafts += 1;
    } else {
      b.submitted += 1;
      const lateness = daysLate(dr.date, dr.updatedAt);
      if (lateness <= 0) b.sameDay += 1;
      else if (lateness === 1) b.oneDay += 1;
      else if (lateness === 2) b.twoDay += 1;
      else b.threePlus += 1;

      b.photos += dr.photoCount ?? 0;
      b.crewRows += dr.crewOnSite.length;
      for (const row of dr.crewOnSite) {
        b.workedMinutes += crewRowWorkedMinutes(row);
      }
      b.jobs.add(dr.jobId);
    }

    buckets.set(dr.foremanId, b);
  }

  const rows: ForemanScorecardRow[] = [];
  let totalPhotos = 0;
  let totalDrafts = 0;
  let lagging = 0;

  for (const b of buckets.values()) {
    const totalSeen = b.submitted + b.drafts;
    const submissionRate = totalSeen === 0 ? 0 : b.submitted / totalSeen;
    const avgPhotos = b.submitted === 0 ? 0 : b.photos / b.submitted;
    const avgCrew = b.submitted === 0 ? 0 : b.crewRows / b.submitted;
    const avgWorkedHours = b.submitted === 0 ? 0 : b.workedMinutes / 60 / b.submitted;
    rows.push({
      foremanId: b.foremanId,
      drsSubmitted: b.submitted,
      sameDayCount: b.sameDay,
      oneDayLateCount: b.oneDay,
      twoDayLateCount: b.twoDay,
      threePlusLateCount: b.threePlus,
      submissionRate: round3(submissionRate),
      draftCount: b.drafts,
      avgPhotos: round1(avgPhotos),
      avgCrewSize: round1(avgCrew),
      avgWorkedHours: round1(avgWorkedHours),
      totalPhotos: b.photos,
      distinctJobs: b.jobs.size,
    });
    totalPhotos += b.photos;
    totalDrafts += b.drafts;
    const lateShare =
      b.submitted === 0 ? 0 : (b.twoDay + b.threePlus) / b.submitted;
    if (lateShare > 0.25) lagging += 1;
  }

  // Most submissions first.
  rows.sort((a, b) => b.drsSubmitted - a.drsSubmitted);

  return {
    rollup: {
      foremen: rows.length,
      totalDrs: rows.reduce((acc, r) => acc + r.drsSubmitted, 0),
      totalDrafts,
      totalPhotos,
      laggingForemen: lagging,
    },
    rows,
  };
}

function daysLate(reportDate: string, submittedAt: string): number {
  // reportDate is yyyy-mm-dd; submittedAt is full ISO. UTC-anchor both.
  const head = submittedAt.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(head)) return 0;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) return 0;
  const r = new Date(`${reportDate}T00:00:00Z`).getTime();
  const s = new Date(`${head}T00:00:00Z`).getTime();
  if (Number.isNaN(r) || Number.isNaN(s)) return 0;
  return Math.round((s - r) / (24 * 60 * 60 * 1000));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
