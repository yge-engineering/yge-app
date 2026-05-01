// Portfolio claim-evidence photos by month.
//
// Plain English: bucket photos in claim categories (DELAY,
// CHANGE_ORDER, INCIDENT, PUNCH) by yyyy-mm. Tracks the
// portfolio-wide evidence collection cadence — drives the
// quarterly safety/quality review.
//
// Per row: month, evidenceCount, delayCount, changeOrderCount,
// incidentCount, punchCount, distinctJobs.
//
// Sort by month asc.
//
// Different from photo-evidence-by-job-monthly (per-job axis),
// photo-by-month (all categories).
//
// Pure derivation. No persisted records.

import type { Photo, PhotoCategory } from './photo';

const EVIDENCE: ReadonlyArray<PhotoCategory> = [
  'DELAY', 'CHANGE_ORDER', 'INCIDENT', 'PUNCH',
];

export interface PhotoEvidencePortfolioMonthlyRow {
  month: string;
  evidenceCount: number;
  delayCount: number;
  changeOrderCount: number;
  incidentCount: number;
  punchCount: number;
  distinctJobs: number;
}

export interface PhotoEvidencePortfolioMonthlyRollup {
  monthsConsidered: number;
  totalEvidence: number;
  monthOverMonthChange: number;
}

export interface PhotoEvidencePortfolioMonthlyInputs {
  photos: Photo[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildPhotoEvidencePortfolioMonthly(
  inputs: PhotoEvidencePortfolioMonthlyInputs,
): {
  rollup: PhotoEvidencePortfolioMonthlyRollup;
  rows: PhotoEvidencePortfolioMonthlyRow[];
} {
  type Bucket = {
    month: string;
    evidence: number;
    delay: number;
    co: number;
    incident: number;
    punch: number;
    jobs: Set<string>;
  };
  const fresh = (month: string): Bucket => ({
    month,
    evidence: 0,
    delay: 0,
    co: 0,
    incident: 0,
    punch: 0,
    jobs: new Set<string>(),
  });
  const buckets = new Map<string, Bucket>();
  let totalEvidence = 0;

  for (const p of inputs.photos) {
    if (!EVIDENCE.includes(p.category)) continue;
    const month = p.takenOn.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const b = buckets.get(month) ?? fresh(month);
    b.evidence += 1;
    b.jobs.add(p.jobId);
    if (p.category === 'DELAY') b.delay += 1;
    else if (p.category === 'CHANGE_ORDER') b.co += 1;
    else if (p.category === 'INCIDENT') b.incident += 1;
    else if (p.category === 'PUNCH') b.punch += 1;
    buckets.set(month, b);
    totalEvidence += 1;
  }

  const rows: PhotoEvidencePortfolioMonthlyRow[] = Array.from(buckets.values())
    .map((b) => ({
      month: b.month,
      evidenceCount: b.evidence,
      delayCount: b.delay,
      changeOrderCount: b.co,
      incidentCount: b.incident,
      punchCount: b.punch,
      distinctJobs: b.jobs.size,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  let mom = 0;
  if (rows.length >= 2) {
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    if (last && prev) mom = last.evidenceCount - prev.evidenceCount;
  }

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalEvidence,
      monthOverMonthChange: mom,
    },
    rows,
  };
}
