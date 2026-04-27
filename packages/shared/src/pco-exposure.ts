// PCO exposure + conversion analytics.
//
// Plain English: a Potential Change Order is money the contractor has
// either spent or expects to spend on work that isn't yet under an
// executed CO. Until the agency signs the CO, that money is exposure
// — work performed without a contract amendment to bill against.
//
// This rolls every PCO into two views:
//   1. Open exposure — total $ currently at risk + the oldest
//      unanswered PCO across all jobs.
//   2. Conversion analytics — historic conversion rate (PCOs that
//      became executed COs) and average days from submitted to
//      converted.
//
// Pure derivation. No persisted records.

import type { Pco, PcoStatus } from './pco';

/** Categorization for the open-exposure rollup. */
export type PcoExposureBucket =
  | 'DRAFT'                  // not yet sent
  | 'SUBMITTED'              // sent, awaiting first response
  | 'UNDER_REVIEW'           // agency has it, in dialogue
  | 'APPROVED_PENDING_CO';   // verbally approved, no executed CO yet

export type PcoConversionOutcome =
  | 'CONVERTED'              // CONVERTED_TO_CO — money is locked in
  | 'REJECTED'               // agency declined
  | 'WITHDRAWN'              // YGE pulled it back
  | 'OPEN';                  // still in flight

export interface PcoExposureRow {
  pcoId: string;
  jobId: string;
  pcoNumber: string;
  title: string;
  status: PcoStatus;
  bucket: PcoExposureBucket | null; // null when closed (CONVERTED, REJECTED, WITHDRAWN)
  outcome: PcoConversionOutcome;

  /** Cost impact at the PCO level (cents). */
  costImpactCents: number;
  scheduleImpactDays: number;

  /** Days since submittedOn (or noticedOn fallback) through asOf. */
  daysOutstanding: number;
  /** True iff submittedOn missing — suggests it's a stale draft. */
  notYetSubmitted: boolean;
}

export interface PcoExposureRollup {
  /** Sum of costImpactCents across all OPEN rows. */
  totalOpenExposureCents: number;
  /** Same, broken down by bucket. */
  exposureByBucket: Record<PcoExposureBucket, number>;
  /** Schedule day exposure across all OPEN rows. */
  totalScheduleImpactDays: number;

  /** The single oldest OPEN PCO — usually the most urgent to chase. */
  oldestOpen: PcoExposureRow | null;
  openCount: number;
}

export interface PcoConversionAnalytics {
  /** All historical PCOs (any outcome). */
  totalPcos: number;
  /** Excludes WITHDRAWN — those are YGE-side decisions, not agency-side. */
  decidedPcos: number;
  /** CONVERTED_TO_CO count. */
  convertedCount: number;
  /** REJECTED count. */
  rejectedCount: number;
  /** convertedCount / decidedPcos. */
  conversionRate: number;

  /** Mean days from submittedOn to lastResponseOn for CONVERTED PCOs.
   *  0 when no CONVERTED PCOs have a submittedOn. */
  avgDaysToConversion: number;
}

export interface PcoExposureInputs {
  /** ISO yyyy-mm-dd; defaults to today (UTC). */
  asOf?: string;
  pcos: Pco[];
}

export function buildPcoExposure(inputs: PcoExposureInputs): {
  rows: PcoExposureRow[];
  rollup: PcoExposureRollup;
  conversion: PcoConversionAnalytics;
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);

  const rows: PcoExposureRow[] = [];
  for (const p of inputs.pcos) {
    const bucket = openBucketFor(p.status);
    const outcome = outcomeFor(p.status);

    const refDate = p.submittedOn ?? p.noticedOn;
    const daysOutstanding = Math.max(0, daysBetween(refDate, asOf));

    rows.push({
      pcoId: p.id,
      jobId: p.jobId,
      pcoNumber: p.pcoNumber,
      title: p.title,
      status: p.status,
      bucket,
      outcome,
      costImpactCents: p.costImpactCents,
      scheduleImpactDays: p.scheduleImpactDays,
      daysOutstanding,
      notYetSubmitted: !p.submittedOn,
    });
  }

  // ---- Open exposure rollup ------------------------------------

  const exposureByBucket: Record<PcoExposureBucket, number> = {
    DRAFT: 0,
    SUBMITTED: 0,
    UNDER_REVIEW: 0,
    APPROVED_PENDING_CO: 0,
  };
  let totalOpenExposureCents = 0;
  let totalScheduleImpactDays = 0;
  let openCount = 0;
  let oldestOpen: PcoExposureRow | null = null;

  for (const r of rows) {
    if (r.outcome !== 'OPEN' || r.bucket == null) continue;
    openCount += 1;
    totalOpenExposureCents += r.costImpactCents;
    exposureByBucket[r.bucket] += r.costImpactCents;
    totalScheduleImpactDays += r.scheduleImpactDays;
    if (!oldestOpen || r.daysOutstanding > oldestOpen.daysOutstanding) {
      oldestOpen = r;
    }
  }

  // Sort: open first, oldest first within open. Closed at the
  // bottom in status order: CONVERTED, REJECTED, WITHDRAWN.
  const outcomeRank: Record<PcoConversionOutcome, number> = {
    OPEN: 0,
    CONVERTED: 1,
    REJECTED: 2,
    WITHDRAWN: 3,
  };
  rows.sort((a, b) => {
    if (a.outcome !== b.outcome) {
      return outcomeRank[a.outcome] - outcomeRank[b.outcome];
    }
    return b.daysOutstanding - a.daysOutstanding;
  });

  // ---- Conversion analytics ------------------------------------

  let convertedCount = 0;
  let rejectedCount = 0;
  let withdrawnCount = 0;
  let conversionDaysSum = 0;
  let conversionDaysSamples = 0;

  for (const p of inputs.pcos) {
    if (p.status === 'CONVERTED_TO_CO') {
      convertedCount += 1;
      // Use lastResponseOn as a proxy for "agency executed CO"; fall
      // back to updatedAt date.
      const endDate =
        p.lastResponseOn ??
        (p.updatedAt ? p.updatedAt.slice(0, 10) : null);
      if (p.submittedOn && endDate) {
        const d = Math.max(0, daysBetween(p.submittedOn, endDate));
        conversionDaysSum += d;
        conversionDaysSamples += 1;
      }
    } else if (p.status === 'REJECTED') {
      rejectedCount += 1;
    } else if (p.status === 'WITHDRAWN') {
      withdrawnCount += 1;
    }
  }

  const decidedPcos = convertedCount + rejectedCount; // exclude WITHDRAWN
  const conversionRate =
    decidedPcos === 0 ? 0 : convertedCount / decidedPcos;
  const avgDaysToConversion =
    conversionDaysSamples === 0
      ? 0
      : Math.round(conversionDaysSum / conversionDaysSamples);

  return {
    rows,
    rollup: {
      totalOpenExposureCents,
      exposureByBucket,
      totalScheduleImpactDays,
      oldestOpen,
      openCount,
    },
    conversion: {
      totalPcos: inputs.pcos.length,
      decidedPcos,
      convertedCount,
      rejectedCount,
      conversionRate,
      avgDaysToConversion,
    },
  };
}

function openBucketFor(status: PcoStatus): PcoExposureBucket | null {
  if (status === 'DRAFT') return 'DRAFT';
  if (status === 'SUBMITTED') return 'SUBMITTED';
  if (status === 'UNDER_REVIEW') return 'UNDER_REVIEW';
  if (status === 'APPROVED_PENDING_CO') return 'APPROVED_PENDING_CO';
  return null;
}

function outcomeFor(status: PcoStatus): PcoConversionOutcome {
  if (status === 'CONVERTED_TO_CO') return 'CONVERTED';
  if (status === 'REJECTED') return 'REJECTED';
  if (status === 'WITHDRAWN') return 'WITHDRAWN';
  return 'OPEN';
}

function daysBetween(from: string, to: string): number {
  const f = Date.parse(`${from}T00:00:00Z`);
  const t = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(f) || Number.isNaN(t)) return 0;
  return Math.round((t - f) / (24 * 60 * 60 * 1000));
}
