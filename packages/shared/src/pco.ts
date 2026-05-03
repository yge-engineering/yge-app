// PCO — Potential / Pending Change Order.
//
// Lives in the gap between "we noticed something off-scope" (often
// captured as an RFI or notice-of-impact letter) and "we have an
// executed CO with a number". PCOs are how a contractor tracks
// EXPOSURE: cost + schedule impact already worked or about to be
// worked but not yet contracted for.
//
// Phase 1 captures the data; the dashboard surfaces:
//   - total $ pending review
//   - total $ approved-pending-CO
//   - schedule-day exposure
//   - oldest unanswered PCO

import { z } from 'zod';
import { translate, SEED_DICTIONARY, type Locale } from './i18n';

export const PcoStatusSchema = z.enum([
  'DRAFT',                 // we haven't sent it to the agency
  'SUBMITTED',             // submitted, awaiting response
  'UNDER_REVIEW',          // agency has it, asking questions
  'APPROVED_PENDING_CO',   // verbally / in writing approved, no executed CO yet
  'REJECTED',
  'WITHDRAWN',
  'CONVERTED_TO_CO',       // an executed CO replaces this PCO
]);
export type PcoStatus = z.infer<typeof PcoStatusSchema>;

export const PcoOriginSchema = z.enum([
  'OWNER_DIRECTED',
  'DESIGN_CHANGE',
  'UNFORESEEN_CONDITION',
  'RFI_RESPONSE',
  'SPEC_CONFLICT',
  'WEATHER_DELAY',
  'OTHER',
]);
export type PcoOrigin = z.infer<typeof PcoOriginSchema>;

export const PcoSchema = z.object({
  /** Stable id `pco-<8hex>`. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  jobId: z.string().min(1).max(120),
  /** Free-form contractor PCO number ("PCO-001"). */
  pcoNumber: z.string().min(1).max(40),
  /** Optional agency PCO number once they assign one. */
  agencyPcoNumber: z.string().max(40).optional(),

  /** Short title. */
  title: z.string().min(1).max(200),
  /** Detailed scope of the proposed change. */
  description: z.string().max(20_000),

  origin: PcoOriginSchema.default('OTHER'),
  status: PcoStatusSchema.default('DRAFT'),

  /** Date the issue was first noticed / triggered. (yyyy-mm-dd) */
  noticedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),
  /** Date the PCO was submitted to the agency. (yyyy-mm-dd) */
  submittedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd').optional(),
  /** Latest agency response date. (yyyy-mm-dd) */
  lastResponseOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd').optional(),

  /** Estimated cost impact, cents. Positive = add, negative = credit. */
  costImpactCents: z.number().int().default(0),
  /** Estimated schedule impact in calendar days. Positive = extension. */
  scheduleImpactDays: z.number().int().default(0),

  /** Optional link to triggering RFI. */
  rfiId: z.string().max(120).optional(),
  /** Once a real CO is executed, link it here so we can hide the PCO
   *  from the open-exposure roll-up. */
  changeOrderId: z.string().max(120).optional(),

  /** People + agency contact. */
  agencyContact: z.string().max(120).optional(),
  preparedByName: z.string().max(120).optional(),

  notes: z.string().max(10_000).optional(),
});
export type Pco = z.infer<typeof PcoSchema>;

export const PcoCreateSchema = PcoSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  origin: PcoOriginSchema.optional(),
  status: PcoStatusSchema.optional(),
  costImpactCents: z.number().int().optional(),
  scheduleImpactDays: z.number().int().optional(),
});
export type PcoCreate = z.infer<typeof PcoCreateSchema>;

export const PcoPatchSchema = PcoCreateSchema.partial();
export type PcoPatch = z.infer<typeof PcoPatchSchema>;

// ---- Helpers -------------------------------------------------------------

export function pcoStatusLabel(s: PcoStatus, locale: Locale = 'en'): string {
  return translate(SEED_DICTIONARY, locale, `pcoStatus.${s}`);
}

export function pcoOriginLabel(o: PcoOrigin, locale: Locale = 'en'): string {
  return translate(SEED_DICTIONARY, locale, `pcoOrigin.${o}`);
}

/** True iff the PCO is open exposure — submitted/in-review/approved
 *  but not yet executed as a CO. */
export function isOpenExposure(p: Pco): boolean {
  return (
    p.status === 'SUBMITTED' ||
    p.status === 'UNDER_REVIEW' ||
    p.status === 'APPROVED_PENDING_CO'
  );
}

/**
 * Days since submittal where the agency hasn't responded. Returns 0 if
 * the PCO hasn't been submitted, or if a response was received. Used to
 * surface "stale" PCOs in the dashboard.
 */
export function daysAwaitingResponse(p: Pco, now: Date = new Date()): number {
  if (!p.submittedOn) return 0;
  if (p.lastResponseOn && p.lastResponseOn >= p.submittedOn) return 0;
  if (
    p.status === 'WITHDRAWN' ||
    p.status === 'REJECTED' ||
    p.status === 'CONVERTED_TO_CO'
  ) {
    return 0;
  }
  const submitted = new Date(p.submittedOn + 'T00:00:00');
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(
    0,
    Math.floor((now.getTime() - submitted.getTime()) / msPerDay),
  );
}

export interface PcoRollup {
  total: number;
  draft: number;
  submitted: number;
  underReview: number;
  approvedPendingCo: number;
  rejected: number;
  /** Total $ in PCOs that aren't rejected/withdrawn/closed. */
  openExposureCents: number;
  /** Total $ in PCOs already verbally approved but no CO yet. */
  approvedPendingCoCents: number;
  /** Total schedule day exposure across open PCOs. */
  openScheduleDays: number;
  /** Oldest open PCO awaiting agency response. */
  oldestAwaitingDays: number;
}

export function computePcoRollup(pcos: Pco[], now: Date = new Date()): PcoRollup {
  let draft = 0;
  let submitted = 0;
  let underReview = 0;
  let approvedPendingCo = 0;
  let rejected = 0;
  let openExposureCents = 0;
  let approvedPendingCoCents = 0;
  let openScheduleDays = 0;
  let oldestAwaitingDays = 0;
  for (const p of pcos) {
    if (p.status === 'DRAFT') draft += 1;
    else if (p.status === 'SUBMITTED') submitted += 1;
    else if (p.status === 'UNDER_REVIEW') underReview += 1;
    else if (p.status === 'APPROVED_PENDING_CO') approvedPendingCo += 1;
    else if (p.status === 'REJECTED') rejected += 1;
    if (isOpenExposure(p)) {
      openExposureCents += p.costImpactCents;
      openScheduleDays += p.scheduleImpactDays;
      const wait = daysAwaitingResponse(p, now);
      if (wait > oldestAwaitingDays) oldestAwaitingDays = wait;
    }
    if (p.status === 'APPROVED_PENDING_CO') {
      approvedPendingCoCents += p.costImpactCents;
    }
  }
  return {
    total: pcos.length,
    draft,
    submitted,
    underReview,
    approvedPendingCo,
    rejected,
    openExposureCents,
    approvedPendingCoCents,
    openScheduleDays,
    oldestAwaitingDays,
  };
}

export function newPcoId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `pco-${hex.padStart(8, '0')}`;
}
