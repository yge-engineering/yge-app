// Incident — workplace injury / illness record (OSHA 300 + 301).
//
// Federal: 29 CFR Part 1904 — Recording and reporting occupational
// injuries and illnesses. Required for any work-related injury or
// illness that meets ANY of the recording criteria:
//   - death
//   - days away from work
//   - restricted work or transfer to another job
//   - medical treatment beyond first aid
//   - loss of consciousness
//   - significant injury or illness diagnosed by a physician
//
// California: Cal/OSHA T8 §14300 — adopts federal rules with state
// additions (e.g. tighter 8-hour reporting for "serious" injuries).
//
// Three forms come out of every incident:
//   Form 300  — line on the annual log (one row per case)
//   Form 300A — annual summary (totals across the log) — must be
//               posted Feb 1 - April 30 each year
//   Form 301  — incident report (full narrative, 7-day filing window)
//
// Phase 1 captures every field needed to populate all three forms
// from a single record. Phase 2 will print the actual government PDFs.

import { z } from 'zod';
import { translate, SEED_DICTIONARY, type Locale } from './i18n';

export const IncidentClassificationSchema = z.enum([
  'INJURY',
  'SKIN_DISORDER',
  'RESPIRATORY',
  'POISONING',
  'HEARING_LOSS',
  'OTHER_ILLNESS',
]);
export type IncidentClassification = z.infer<typeof IncidentClassificationSchema>;

export const IncidentOutcomeSchema = z.enum([
  'DEATH',
  'DAYS_AWAY',
  'JOB_TRANSFER_OR_RESTRICTION',
  'OTHER_RECORDABLE',
]);
export type IncidentOutcome = z.infer<typeof IncidentOutcomeSchema>;

export const IncidentStatusSchema = z.enum([
  'OPEN',
  'CLOSED',
]);
export type IncidentStatus = z.infer<typeof IncidentStatusSchema>;

export const IncidentSchema = z.object({
  /** Stable id `inc-<8hex>`. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  /** Sequential case number for the log year (e.g., "2026-001"). */
  caseNumber: z.string().min(1).max(40),
  /** Calendar year for the log this case lives on. */
  logYear: z.number().int().min(2000).max(3000),

  /** Date of injury / onset of illness (yyyy-mm-dd). */
  incidentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),

  /** Employee involved. */
  employeeId: z.string().max(120).optional(),
  employeeName: z.string().min(1).max(120),
  jobTitle: z.string().max(120).optional(),

  /** Where the event occurred (jobsite, address, station). */
  location: z.string().min(1).max(400),
  /** Optional job association. */
  jobId: z.string().max(120).optional(),

  /** Description for Form 300 columns: "Describe injury or illness, parts
   *  of body affected, and object/substance that directly injured or made
   *  person ill." */
  description: z.string().min(1).max(4_000),

  classification: IncidentClassificationSchema,
  outcome: IncidentOutcomeSchema,

  /** Days away from work (Form 300 col K). */
  daysAway: z.number().int().nonnegative().default(0),
  /** Days of job transfer or restriction (Form 300 col L). */
  daysRestricted: z.number().int().nonnegative().default(0),

  /** True if this case is privacy-concern per §1904.29(b)(7) (e.g.,
   *  injury to intimate body parts, sexual assault, mental illness).
   *  Privacy cases are logged with "Privacy Case" instead of name. */
  privacyCase: z.boolean().default(false),

  // ---- Form 301 fields -----------------------------------------------------

  /** Time the event occurred (HH:MM 24h). */
  incidentTime: z.string().max(5).optional(),
  /** Time the employee began work that day (HH:MM 24h). */
  workStartTime: z.string().max(5).optional(),
  /** What the employee was doing just before the incident. */
  taskBeforeIncident: z.string().max(2_000).optional(),
  /** What happened — narrative. */
  whatHappened: z.string().max(4_000).optional(),
  /** What was the injury / illness — body part(s) affected. */
  injuryDescription: z.string().max(2_000).optional(),
  /** Object / substance that directly harmed the employee. */
  harmingAgent: z.string().max(500).optional(),

  /** Date employee was hired (helps establish work-relatedness for
   *  occupational illness). */
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd').optional(),
  /** Did the employee die from this incident? */
  died: z.boolean().default(false),
  dateOfDeath: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd').optional(),

  /** Treating physician + facility. */
  physicianName: z.string().max(200).optional(),
  facilityName: z.string().max(200).optional(),
  facilityAddress: z.string().max(400).optional(),
  treatedInER: z.boolean().default(false),
  hospitalizedOvernight: z.boolean().default(false),

  /** Cal/OSHA "serious injury" reportable? §342 requires reporting any
   *  serious injury to Cal/OSHA within 8 hours. */
  calOshaReported: z.boolean().default(false),
  calOshaReportedAt: z.string().optional(), // ISO datetime

  status: IncidentStatusSchema.default('OPEN'),
  /** Date the case was closed (employee returned to full duty,
   *  restrictions lifted, etc.). */
  closedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd').optional(),

  /** Form 301 prepared by. */
  preparedByName: z.string().max(120).optional(),
  preparedByTitle: z.string().max(80).optional(),
  preparedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd').optional(),

  notes: z.string().max(20_000).optional(),
});
export type Incident = z.infer<typeof IncidentSchema>;

export const IncidentCreateSchema = IncidentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: IncidentStatusSchema.optional(),
  daysAway: z.number().int().nonnegative().optional(),
  daysRestricted: z.number().int().nonnegative().optional(),
  privacyCase: z.boolean().optional(),
  died: z.boolean().optional(),
  treatedInER: z.boolean().optional(),
  hospitalizedOvernight: z.boolean().optional(),
  calOshaReported: z.boolean().optional(),
});
export type IncidentCreate = z.infer<typeof IncidentCreateSchema>;

export const IncidentPatchSchema = IncidentCreateSchema.partial();
export type IncidentPatch = z.infer<typeof IncidentPatchSchema>;

// ---- Helpers -------------------------------------------------------------

export function incidentClassificationLabel(c: IncidentClassification, locale: Locale = 'en'): string {
  return translate(SEED_DICTIONARY, locale, `incident.classification.${c}`);
}

export function incidentOutcomeLabel(o: IncidentOutcome, locale: Locale = 'en'): string {
  return translate(SEED_DICTIONARY, locale, `incident.outcome.${o}`);
}

export function incidentStatusLabel(s: IncidentStatus, locale: Locale = 'en'): string {
  return translate(SEED_DICTIONARY, locale, `incident.status.${s}`);
}

/**
 * Form 300A annual summary totals.
 *
 * Computed from a year's incidents. The numbers below match the boxes
 * on the OSHA 300A form. Posted Feb 1 - Apr 30 each year per §1904.32.
 */
export interface Form300ASummary {
  year: number;
  totalCases: number;
  totalDeaths: number;
  totalDaysAwayCases: number;
  totalRestrictedCases: number;
  totalOtherRecordableCases: number;
  totalDaysAway: number;
  totalDaysRestricted: number;
  byClassification: {
    injuries: number;
    skinDisorders: number;
    respiratoryConditions: number;
    poisonings: number;
    hearingLoss: number;
    allOtherIllnesses: number;
  };
}

export function computeForm300A(
  incidents: Incident[],
  year: number,
): Form300ASummary {
  const yr = incidents.filter((i) => i.logYear === year);
  let totalDeaths = 0;
  let totalDaysAwayCases = 0;
  let totalRestrictedCases = 0;
  let totalOtherRecordableCases = 0;
  let totalDaysAway = 0;
  let totalDaysRestricted = 0;
  let injuries = 0;
  let skinDisorders = 0;
  let respiratoryConditions = 0;
  let poisonings = 0;
  let hearingLoss = 0;
  let allOtherIllnesses = 0;
  for (const inc of yr) {
    if (inc.outcome === 'DEATH' || inc.died) totalDeaths += 1;
    if (inc.outcome === 'DAYS_AWAY') totalDaysAwayCases += 1;
    if (inc.outcome === 'JOB_TRANSFER_OR_RESTRICTION') totalRestrictedCases += 1;
    if (inc.outcome === 'OTHER_RECORDABLE') totalOtherRecordableCases += 1;
    totalDaysAway += inc.daysAway;
    totalDaysRestricted += inc.daysRestricted;
    switch (inc.classification) {
      case 'INJURY': injuries += 1; break;
      case 'SKIN_DISORDER': skinDisorders += 1; break;
      case 'RESPIRATORY': respiratoryConditions += 1; break;
      case 'POISONING': poisonings += 1; break;
      case 'HEARING_LOSS': hearingLoss += 1; break;
      case 'OTHER_ILLNESS': allOtherIllnesses += 1; break;
    }
  }
  return {
    year,
    totalCases: yr.length,
    totalDeaths,
    totalDaysAwayCases,
    totalRestrictedCases,
    totalOtherRecordableCases,
    totalDaysAway,
    totalDaysRestricted,
    byClassification: {
      injuries,
      skinDisorders,
      respiratoryConditions,
      poisonings,
      hearingLoss,
      allOtherIllnesses,
    },
  };
}

export interface IncidentRollup {
  total: number;
  open: number;
  closed: number;
  /** Cases this calendar year. */
  thisYearCases: number;
  /** YTD total days away. */
  thisYearDaysAway: number;
  /** Cal/OSHA-reportable but NOT YET reported (red flag). */
  unreportedSerious: number;
}

/** Heuristic: a case is "serious" for Cal/OSHA §342 8-hour reporting if
 *  it caused death, hospitalization overnight, or amputation/serious
 *  injury (we approximate as: died OR hospitalized OR daysAway >=
 *  threshold). Returns true if this case probably needs an 8-hour
 *  Cal/OSHA call. */
export function isSeriousReportable(inc: Incident): boolean {
  return inc.died || inc.hospitalizedOvernight || inc.outcome === 'DEATH';
}

export function computeIncidentRollup(
  incidents: Incident[],
  asOf: Date = new Date(),
): IncidentRollup {
  const year = asOf.getFullYear();
  let open = 0;
  let closed = 0;
  let thisYearCases = 0;
  let thisYearDaysAway = 0;
  let unreportedSerious = 0;
  for (const inc of incidents) {
    if (inc.status === 'OPEN') open += 1;
    else if (inc.status === 'CLOSED') closed += 1;
    if (inc.logYear === year) {
      thisYearCases += 1;
      thisYearDaysAway += inc.daysAway;
    }
    if (isSeriousReportable(inc) && !inc.calOshaReported) {
      unreportedSerious += 1;
    }
  }
  return {
    total: incidents.length,
    open,
    closed,
    thisYearCases,
    thisYearDaysAway,
    unreportedSerious,
  };
}

export function newIncidentId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `inc-${hex.padStart(8, '0')}`;
}
