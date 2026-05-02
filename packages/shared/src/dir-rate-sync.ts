// DIR rate sync — staging + diff + review + apply.
//
// Plain English: the live rate set drives bid pricing + payroll +
// CPRs. We don't write straight to it from a scraper because (a)
// DIR's website occasionally publishes mistakes that get corrected
// days later, and (b) a wrong rate that sneaks through silently
// poisons every open bid + every CPR that runs in that window.
// Instead, scrapes land in a staging area as `DirRateProposal`
// rows. A human reviews each one — accept, reject, or edit-and-
// accept — and only accepted proposals roll into the live rates.
//
// Data model:
//   DirRateSyncRun  — one row per scrape attempt
//                     (timestamp, source, status, counts, notes)
//   DirRateProposal — one row per (classification, county) the
//                     scraper hit. Holds the proposed rate +
//                     a pointer to the existing rate it would
//                     replace (null on a brand-new determination).
//                     Has its own review status + reasons.
//
// Phase 1 ships the data model + diff machinery + accept/reject
// pure-data helpers. The Caltrans-quality scraper, the diff-review
// UI, and the manual PDF upload flow build on top in subsequent
// commits.

import { z } from 'zod';
import { DirClassificationSchema } from './employee';
import { DirRateSchema, totalPrevailingWageCents, type DirRate } from './dir-rate';

// ---- Sync run -----------------------------------------------------------

export const DirRateSyncSourceSchema = z.enum([
  'SCHEDULED', // automated scrape job (cron-driven)
  'MANUAL',    // 'Run sync now' button
  'PDF_IMPORT', // operator uploaded a PDF; AI parsed it
]);
export type DirRateSyncSource = z.infer<typeof DirRateSyncSourceSchema>;

export const DirRateSyncStatusSchema = z.enum([
  'QUEUED',
  'RUNNING',
  'SUCCESS',
  'FAILED',
  'PARTIAL', // some classifications scraped, some failed
]);
export type DirRateSyncStatus = z.infer<typeof DirRateSyncStatusSchema>;

export const DirRateSyncRunSchema = z.object({
  /** Stable id `dir-sync-<8hex>`. */
  id: z.string().min(1).max(80),
  createdAt: z.string(),
  updatedAt: z.string(),

  source: DirRateSyncSourceSchema,
  status: DirRateSyncStatusSchema.default('QUEUED'),

  /** When the run actually started. Null until status flips RUNNING. */
  startedAt: z.string().optional(),
  /** When the run finished, regardless of outcome. */
  finishedAt: z.string().optional(),

  /** Counts the run wrote / would write. Null until at least one
   *  classification has been processed. */
  proposalsCreated: z.number().int().nonnegative().default(0),
  classificationsScraped: z.number().int().nonnegative().default(0),
  classificationsFailed: z.number().int().nonnegative().default(0),

  /** Free-form summary — typically the AI's drafted plain-English
   *  summary of what changed ('AC Asphalt classification went up
   *  $2.10/hr in Region 2'). Plain-English so Ryan can sign off in
   *  10 seconds. */
  summary: z.string().max(8000).optional(),
  /** Detailed error messages on FAILED / PARTIAL. */
  errorMessages: z.array(z.string().max(2000)).default([]),

  /** Operator who initiated MANUAL / PDF_IMPORT runs. Null on
   *  SCHEDULED. */
  initiatedByUserId: z.string().max(120).optional(),
  /** Source URL or PDF reference for traceability. */
  sourceReference: z.string().max(800).optional(),
});
export type DirRateSyncRun = z.infer<typeof DirRateSyncRunSchema>;

// ---- Proposal -----------------------------------------------------------

export const DirRateProposalStatusSchema = z.enum([
  'PENDING',  // waiting for review
  'ACCEPTED', // applied to live rates (cannot un-apply through the UI;
              // edit a new proposal to override)
  'REJECTED', // not applied, keeps pre-existing live rate untouched
  'STALE',    // a newer scrape superseded this proposal before review
]);
export type DirRateProposalStatus = z.infer<typeof DirRateProposalStatusSchema>;

/**
 * One per (classification, county) the scraper hit. The proposed
 * rate body matches the live DirRate shape exactly so accept-and-
 * apply is a clean copy.
 */
export const DirRateProposalSchema = z.object({
  /** Stable id `dir-prop-<8hex>`. */
  id: z.string().min(1).max(80),
  createdAt: z.string(),
  updatedAt: z.string(),

  /** Sync run that produced this proposal. */
  syncRunId: z.string().min(1).max(80),

  classification: DirClassificationSchema,
  county: z.string().min(1).max(80),

  /** Live DirRate this proposal targets — null when the (classification,
   *  county) is new (first determination ever). */
  existingRateId: z.string().max(80).nullable(),

  /** The proposed rate body. Same shape as a DirRate row minus the
   *  id / timestamps (those are filled when applied). */
  proposedRate: DirRateSchema.omit({ id: true, createdAt: true, updatedAt: true }),

  status: DirRateProposalStatusSchema.default('PENDING'),

  /** Free-form rationale the AI / scraper attached — 'Picked up new
   *  Aug 22 determination at https://...; basic rate moves +$2.10/hr,
   *  pension fringe unchanged.' */
  rationale: z.string().max(8000).optional(),

  /** Filled when reviewed. */
  reviewedAt: z.string().optional(),
  reviewedByUserId: z.string().max(120).optional(),
  reviewNote: z.string().max(2000).optional(),
});
export type DirRateProposal = z.infer<typeof DirRateProposalSchema>;

// ---- Diff machinery -----------------------------------------------------

/**
 * Per-field diff between an existing rate and the proposed rate. We
 * report the cents delta for every monetary field plus changes to
 * effectiveDate / expiresOn / sourceUrl / notes. New (no existing)
 * proposals report `kind: 'new'` and the diff is moot.
 */
export interface DirRateProposalDiff {
  kind: 'new' | 'updated' | 'identical';
  /** When kind = 'updated', the per-field deltas in cents. Positive
   *  numbers = proposed value is higher than existing. */
  cents: {
    basicHourlyCents: number;
    healthAndWelfareCents: number;
    pensionCents: number;
    vacationHolidayCents: number;
    trainingCents: number;
    otherFringeCents: number;
    totalPrevailingWageCents: number;
  };
  /** Non-monetary fields that changed. Top-level keys only. */
  changedFields: string[];
  /** True when the total prevailing wage moves >= the threshold the
   *  reviewer's UI nags on. Default threshold (cents) is configurable. */
  significantWageMove: boolean;
}

const SIGNIFICANT_MOVE_DEFAULT_CENTS = 25; // $0.25 / hr

/**
 * Compute the diff for a proposal against its existing rate (or
 * none, on a brand-new determination).
 */
export function computeProposalDiff(
  existing: DirRate | null,
  proposed: DirRateProposal['proposedRate'],
  opts?: { significantMoveCents?: number },
): DirRateProposalDiff {
  if (!existing) {
    return {
      kind: 'new',
      cents: {
        basicHourlyCents: proposed.basicHourlyCents,
        healthAndWelfareCents: proposed.healthAndWelfareCents,
        pensionCents: proposed.pensionCents,
        vacationHolidayCents: proposed.vacationHolidayCents,
        trainingCents: proposed.trainingCents,
        otherFringeCents: proposed.otherFringeCents,
        totalPrevailingWageCents: totalPrevailingWageCents(proposed),
      },
      changedFields: [],
      significantWageMove: true, // every brand-new det is 'significant'
    };
  }

  const cents = {
    basicHourlyCents: proposed.basicHourlyCents - existing.basicHourlyCents,
    healthAndWelfareCents: proposed.healthAndWelfareCents - existing.healthAndWelfareCents,
    pensionCents: proposed.pensionCents - existing.pensionCents,
    vacationHolidayCents: proposed.vacationHolidayCents - existing.vacationHolidayCents,
    trainingCents: proposed.trainingCents - existing.trainingCents,
    otherFringeCents: proposed.otherFringeCents - existing.otherFringeCents,
    totalPrevailingWageCents:
      totalPrevailingWageCents(proposed) - totalPrevailingWageCents(existing),
  };

  const changedFields: string[] = [];
  if (proposed.effectiveDate !== existing.effectiveDate) changedFields.push('effectiveDate');
  if ((proposed.expiresOn ?? '') !== (existing.expiresOn ?? '')) changedFields.push('expiresOn');
  if ((proposed.notes ?? '') !== (existing.notes ?? '')) changedFields.push('notes');
  if ((proposed.sourceUrl ?? '') !== (existing.sourceUrl ?? '')) changedFields.push('sourceUrl');

  const anyMonetaryChange =
    cents.basicHourlyCents !== 0 ||
    cents.healthAndWelfareCents !== 0 ||
    cents.pensionCents !== 0 ||
    cents.vacationHolidayCents !== 0 ||
    cents.trainingCents !== 0 ||
    cents.otherFringeCents !== 0;

  const kind: DirRateProposalDiff['kind'] =
    anyMonetaryChange || changedFields.length > 0 ? 'updated' : 'identical';

  const threshold = opts?.significantMoveCents ?? SIGNIFICANT_MOVE_DEFAULT_CENTS;
  const significantWageMove =
    Math.abs(cents.totalPrevailingWageCents) >= threshold;

  return { kind, cents, changedFields, significantWageMove };
}

// ---- Apply / reject -----------------------------------------------------

/**
 * Build the DirRate shape that should be persisted when the
 * proposal is accepted. The caller is responsible for routing this
 * through whatever store is in play (file or Prisma). When existing
 * is null the result is a fresh row id-less; the store assigns the
 * id at write time.
 */
export interface AcceptedProposalApplication {
  /** Mode: 'create' = brand-new DirRate; 'update' = patch over the
   *  existing one. */
  mode: 'create' | 'update';
  /** When mode = 'update', the id of the live rate to patch. */
  targetRateId: string | null;
  /** Body to write. createdAt and updatedAt are caller-managed. */
  body: Omit<DirRate, 'id' | 'createdAt' | 'updatedAt'>;
}

export function buildAcceptedApplication(
  proposal: DirRateProposal,
  existing: DirRate | null,
): AcceptedProposalApplication {
  if (!existing) {
    return {
      mode: 'create',
      targetRateId: null,
      body: proposal.proposedRate,
    };
  }
  return {
    mode: 'update',
    targetRateId: existing.id,
    body: proposal.proposedRate,
  };
}

// ---- Run rollup ---------------------------------------------------------

export interface DirRateSyncRunRollup {
  total: number;
  /** Counts by status. */
  byStatus: Record<DirRateSyncStatus, number>;
  /** Most-recent finishedAt across the set. */
  lastFinishedAt: string | null;
  /** Sum of proposalsCreated over all runs. */
  totalProposalsCreated: number;
}

export function computeSyncRunRollup(runs: DirRateSyncRun[]): DirRateSyncRunRollup {
  const byStatus: Record<DirRateSyncStatus, number> = {
    QUEUED: 0, RUNNING: 0, SUCCESS: 0, FAILED: 0, PARTIAL: 0,
  };
  let lastFinishedAt: string | null = null;
  let totalProposalsCreated = 0;
  for (const r of runs) {
    byStatus[r.status] += 1;
    if (r.finishedAt && (!lastFinishedAt || r.finishedAt > lastFinishedAt)) {
      lastFinishedAt = r.finishedAt;
    }
    totalProposalsCreated += r.proposalsCreated;
  }
  return {
    total: runs.length,
    byStatus,
    lastFinishedAt,
    totalProposalsCreated,
  };
}

export interface DirRateProposalRollup {
  total: number;
  byStatus: Record<DirRateProposalStatus, number>;
  /** Pending proposals where the wage moved a 'significant' amount.
   *  Drives the dashboard 'X rates need your review' badge. */
  pendingSignificantCount: number;
}

export function computeProposalRollup(
  proposals: DirRateProposal[],
  diffs: Map<string, DirRateProposalDiff>,
): DirRateProposalRollup {
  const byStatus: Record<DirRateProposalStatus, number> = {
    PENDING: 0, ACCEPTED: 0, REJECTED: 0, STALE: 0,
  };
  let pendingSignificantCount = 0;
  for (const p of proposals) {
    byStatus[p.status] += 1;
    if (p.status === 'PENDING') {
      const d = diffs.get(p.id);
      if (d?.significantWageMove) pendingSignificantCount += 1;
    }
  }
  return {
    total: proposals.length,
    byStatus,
    pendingSignificantCount,
  };
}

// ---- Id helpers ---------------------------------------------------------

export function newDirRateSyncRunId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `dir-sync-${hex.padStart(8, '0')}`;
}

export function newDirRateProposalId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `dir-prop-${hex.padStart(8, '0')}`;
}
