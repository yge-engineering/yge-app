// Per (job, month) claim-evidence photo rollup.
//
// Plain English: bucket photos by (jobId, yyyy-mm of takenOn)
// and sum just the claim-defense categories — DELAY,
// CHANGE_ORDER, INCIDENT, PUNCH. Different from photo-by-job-
// monthly which counts every photo. This is the "evidence
// photos for the binder" cut.
//
// Per row: jobId, month, evidenceCount, delayCount,
// changeOrderCount, incidentCount, punchCount, distinctDays.
//
// Sort: jobId asc, month asc.
//
// Different from job-photo-monthly (all categories), photo-
// evidence (per-photo cross-ref index).
//
// Pure derivation. No persisted records.

import type { Photo, PhotoCategory } from './photo';

const EVIDENCE: ReadonlyArray<PhotoCategory> = [
  'DELAY', 'CHANGE_ORDER', 'INCIDENT', 'PUNCH',
];

export interface PhotoEvidenceByJobMonthlyRow {
  jobId: string;
  month: string;
  evidenceCount: number;
  delayCount: number;
  changeOrderCount: number;
  incidentCount: number;
  punchCount: number;
  distinctDays: number;
}

export interface PhotoEvidenceByJobMonthlyRollup {
  jobsConsidered: number;
  monthsConsidered: number;
  totalEvidence: number;
}

export interface PhotoEvidenceByJobMonthlyInputs {
  photos: Photo[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildPhotoEvidenceByJobMonthly(
  inputs: PhotoEvidenceByJobMonthlyInputs,
): {
  rollup: PhotoEvidenceByJobMonthlyRollup;
  rows: PhotoEvidenceByJobMonthlyRow[];
} {
  type Acc = {
    jobId: string;
    month: string;
    evidence: number;
    delay: number;
    co: number;
    incident: number;
    punch: number;
    days: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const jobSet = new Set<string>();
  const monthSet = new Set<string>();
  let totalEvidence = 0;

  for (const p of inputs.photos) {
    if (!EVIDENCE.includes(p.category)) continue;
    const month = p.takenOn.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const key = `${p.jobId}|${month}`;
    const acc = accs.get(key) ?? {
      jobId: p.jobId,
      month,
      evidence: 0,
      delay: 0,
      co: 0,
      incident: 0,
      punch: 0,
      days: new Set<string>(),
    };
    acc.evidence += 1;
    acc.days.add(p.takenOn);
    if (p.category === 'DELAY') acc.delay += 1;
    else if (p.category === 'CHANGE_ORDER') acc.co += 1;
    else if (p.category === 'INCIDENT') acc.incident += 1;
    else if (p.category === 'PUNCH') acc.punch += 1;
    accs.set(key, acc);
    jobSet.add(p.jobId);
    monthSet.add(month);
    totalEvidence += 1;
  }

  const rows: PhotoEvidenceByJobMonthlyRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      jobId: acc.jobId,
      month: acc.month,
      evidenceCount: acc.evidence,
      delayCount: acc.delay,
      changeOrderCount: acc.co,
      incidentCount: acc.incident,
      punchCount: acc.punch,
      distinctDays: acc.days.size,
    });
  }

  rows.sort((a, b) => {
    if (a.jobId !== b.jobId) return a.jobId.localeCompare(b.jobId);
    return a.month.localeCompare(b.month);
  });

  return {
    rollup: {
      jobsConsidered: jobSet.size,
      monthsConsidered: monthSet.size,
      totalEvidence,
    },
    rows,
  };
}
