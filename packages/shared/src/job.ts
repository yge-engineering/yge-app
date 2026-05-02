// Job — the unit of work YGE bids on.
//
// One job spawns 0..N drafts (Plans-to-Estimate AI runs) and 0..N priced
// estimates (the editable per-line worksheet). Phase 1 stand-in for the
// future Postgres `Job` table; surface area maps 1:1 to a Prisma
// repository so the Postgres swap is a one-day rewrite.
//
// What goes here vs. on the estimate? The job carries the *constants*
// for the project — owner agency, location, contract type, who's
// pursuing it. Each estimate carries the *bid math* — bid items, unit
// prices, O&P, sub list, security, addenda. One job, many estimates
// (rare, but happens when the agency reissues an RFP).

import { z } from 'zod';
import { PtoEProjectTypeSchema } from './plans-to-estimate-output';
import { translate, SEED_DICTIONARY, type Locale } from './i18n';

/** What kind of contract are we bidding? Drives downstream rules:
 *  - PUBLIC_WORKS triggers DIR / certified payroll requirements
 *  - PRIVATE skips most of the §4104 sub-listing pressure
 *  - TASK_ORDER is a slice off a larger pre-awarded contract */
export const JobContractTypeSchema = z.enum([
  'PUBLIC_WORKS',
  'PRIVATE',
  'TASK_ORDER',
  'NEGOTIATED',
  'OTHER',
]);
export type JobContractType = z.infer<typeof JobContractTypeSchema>;

/** Where is the job in YGE's pursuit pipeline? Drives the dashboard view. */
export const JobStatusSchema = z.enum([
  'PROSPECT', // we know about it, haven't decided to pursue
  'PURSUING', // actively working up a bid
  'BID_SUBMITTED', // bid is in the agency's hands
  'AWARDED', // we won
  'LOST', // someone else won
  'NO_BID', // we passed
  'ARCHIVED', // closed-out, retain for records
]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const JobSchema = z.object({
  /** Stable id of the form `job-YYYY-MM-DD-slug-rand`. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  /** Free-form project name — typically the agency's name for the job
   *  (e.g. "Sulphur Springs Soquol Road"). */
  projectName: z.string().min(1).max(200),
  projectType: PtoEProjectTypeSchema,
  contractType: JobContractTypeSchema,
  status: JobStatusSchema.default('PURSUING'),

  /** Owner / awarding agency. Optional but strongly encouraged — drives
   *  the bid summary letterhead and transmittal addressee. */
  ownerAgency: z.string().max(200).optional(),
  /** Project location — typically city, county, or address. */
  location: z.string().max(200).optional(),
  /** ISO date or human string. The bid must be in the agency's hands by
   *  this time. */
  bidDueDate: z.string().max(40).optional(),
  /** Engineer's estimate / agency's published budget, if known. Money
   *  in cents to match the rest of the system. */
  engineersEstimateCents: z.number().int().nonnegative().optional(),

  /** YGE internal: who on staff owns this pursuit. Free-form text for
   *  Phase 1; Phase 2 will tie into User records. */
  pursuitOwner: z.string().max(120).optional(),
  /** Free-form pursuit notes — strategy, walk-through observations,
   *  competitor intel, etc. */
  notes: z.string().max(10_000).optional(),
});
export type Job = z.infer<typeof JobSchema>;

/** What we put in a `POST /jobs` body. */
export const JobCreateSchema = JobSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: JobStatusSchema.optional(), // server defaults to PURSUING
});
export type JobCreate = z.infer<typeof JobCreateSchema>;

/** What we put in a `PATCH /jobs/:id` body — every field optional. */
export const JobPatchSchema = JobCreateSchema.partial();
export type JobPatch = z.infer<typeof JobPatchSchema>;

// ---- Display helpers -----------------------------------------------------

export function contractTypeLabel(t: JobContractType, locale: Locale = 'en'): string {
  return translate(SEED_DICTIONARY, locale, `job.contractType.${t}`);
}

export function statusLabel(s: JobStatus, locale: Locale = 'en'): string {
  // Reads the per-locale label from the seed dictionary; the
  // dictionary fallback lands back in English if a key's missing
  // for the locale, so the helper never returns the bare enum.
  return translate(SEED_DICTIONARY, locale, `job.status.${s}`);
}
