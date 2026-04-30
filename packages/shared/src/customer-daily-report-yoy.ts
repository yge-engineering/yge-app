// Customer-anchored daily-report year-over-year.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// collapse two years of daily reports into a comparison: total
// reports, submitted vs draft, crew rows + hours + photos,
// distinct foremen + jobs, plus deltas.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';
import type { Job } from './job';

import { crewRowWorkedHours } from './daily-report';

export interface CustomerDailyReportYoyResult {
  customerName: string;
  priorYear: number;
  currentYear: number;
  priorTotal: number;
  priorSubmitted: number;
  priorDraft: number;
  priorCrewRows: number;
  priorCrewHours: number;
  priorPhotos: number;
  priorDistinctForemen: number;
  priorDistinctJobs: number;
  currentTotal: number;
  currentSubmitted: number;
  currentDraft: number;
  currentCrewRows: number;
  currentCrewHours: number;
  currentPhotos: number;
  currentDistinctForemen: number;
  currentDistinctJobs: number;
  totalDelta: number;
}

export interface CustomerDailyReportYoyInputs {
  customerName: string;
  dailyReports: DailyReport[];
  jobs: Job[];
  currentYear: number;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildCustomerDailyReportYoy(
  inputs: CustomerDailyReportYoyInputs,
): CustomerDailyReportYoyResult {
  const priorYear = inputs.currentYear - 1;
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Bucket = {
    total: number;
    submitted: number;
    draft: number;
    crewRows: number;
    crewHours: number;
    photos: number;
    foremen: Set<string>;
    jobs: Set<string>;
  };
  function emptyBucket(): Bucket {
    return {
      total: 0,
      submitted: 0,
      draft: 0,
      crewRows: 0,
      crewHours: 0,
      photos: 0,
      foremen: new Set(),
      jobs: new Set(),
    };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const r of inputs.dailyReports) {
    if (!customerJobs.has(r.jobId)) continue;
    const year = Number(r.date.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.total += 1;
    if (r.submitted) b.submitted += 1;
    else b.draft += 1;
    b.crewRows += r.crewOnSite?.length ?? 0;
    for (const row of r.crewOnSite ?? []) b.crewHours += crewRowWorkedHours(row);
    b.photos += r.photoCount ?? 0;
    b.foremen.add(r.foremanId);
    b.jobs.add(r.jobId);
  }

  return {
    customerName: inputs.customerName,
    priorYear,
    currentYear: inputs.currentYear,
    priorTotal: prior.total,
    priorSubmitted: prior.submitted,
    priorDraft: prior.draft,
    priorCrewRows: prior.crewRows,
    priorCrewHours: round2(prior.crewHours),
    priorPhotos: prior.photos,
    priorDistinctForemen: prior.foremen.size,
    priorDistinctJobs: prior.jobs.size,
    currentTotal: current.total,
    currentSubmitted: current.submitted,
    currentDraft: current.draft,
    currentCrewRows: current.crewRows,
    currentCrewHours: round2(current.crewHours),
    currentPhotos: current.photos,
    currentDistinctForemen: current.foremen.size,
    currentDistinctJobs: current.jobs.size,
    totalDelta: current.total - prior.total,
  };
}
