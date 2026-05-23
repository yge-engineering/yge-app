// CA DAS-140 — Public Works Contract Award Information.
//
// 8 CCR §230 requires the awarding-body contractor to notify the applicable
// approved apprenticeship committee(s) within 10 days of contract award.
// One DAS-140 per applicable craft, mailed (or e-mailed) to the local JATC
// in the project's county.
//
// This helper takes plain inputs and returns the structured form data plus a
// computed deadline and a print-ready plain-text rendering. PDF-fill comes
// later via the pre-mapped form library.

import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const Das140InputSchema = z.object({
  /** Awarding body (the agency / GC who hired you). */
  awardingBodyName: z.string().min(1).max(300),
  awardingBodyAddress: z.string().max(400).optional(),
  /** YGE contractor info. */
  contractorName: z.string().min(1).max(300),
  contractorAddress: z.string().min(1).max(400),
  contractorPhone: z.string().max(40).optional(),
  contractorCslb: z.string().max(40),
  contractorDir: z.string().max(40),
  /** Project. */
  projectName: z.string().min(1).max(300),
  projectLocation: z.string().min(1).max(400),
  projectNumber: z.string().max(80).optional(),
  contractAmountCents: z.number().int().positive(),
  /** Date of contract award (yyyy-mm-dd). */
  awardDate: z.string().regex(ISO_DATE, 'Use yyyy-mm-dd'),
  /** Estimated start + completion dates. */
  estimatedStartDate: z.string().regex(ISO_DATE).optional(),
  estimatedCompletionDate: z.string().regex(ISO_DATE).optional(),
  /** Single craft this DAS-140 is for (one DAS-140 per craft). */
  craft: z.string().min(1).max(120),
  /** Estimated journey-level hours + apprentice hours for this craft. */
  estimatedJourneyHours: z.number().int().nonnegative().optional(),
  estimatedApprenticeHours: z.number().int().nonnegative().optional(),
  /** JATC (Joint Apprenticeship Training Committee) recipient. */
  jatcName: z.string().min(1).max(300),
  jatcAddress: z.string().min(1).max(400),
});
export type Das140Input = z.infer<typeof Das140InputSchema>;

export interface Das140Result {
  /** Plain-text rendering suitable for print / PDF / email body. */
  formText: string;
  /** Deadline = awardDate + 10 days (yyyy-mm-dd). */
  notifyByDate: string;
  /** Days until the notify-by deadline. Negative = past. */
  daysUntilDeadline: number;
}

function parseISO(s: string): Date {
  return new Date(s + 'T00:00:00Z');
}
function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

export function buildDas140(input: Das140Input, today: string): Das140Result {
  const notifyByDate = formatDate(addDays(parseISO(input.awardDate), 10));
  const daysUntilDeadline = Math.round(
    (parseISO(notifyByDate).getTime() - parseISO(today).getTime()) /
      (1000 * 60 * 60 * 24),
  );
  const dollars = (input.contractAmountCents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });

  const formText =
    `CALIFORNIA DEPARTMENT OF INDUSTRIAL RELATIONS\n` +
    `DIVISION OF APPRENTICESHIP STANDARDS\n` +
    `PUBLIC WORKS CONTRACT AWARD INFORMATION (DAS-140)\n` +
    `(Required by 8 CCR §230 within 10 days of contract award)\n\n` +
    `TO:    ${input.jatcName}\n` +
    `       ${input.jatcAddress}\n\n` +
    `FROM:  ${input.contractorName}\n` +
    `       ${input.contractorAddress}\n` +
    (input.contractorPhone ? `       Phone: ${input.contractorPhone}\n` : '') +
    `       CSLB License:  ${input.contractorCslb}\n` +
    `       DIR PWC Reg #: ${input.contractorDir}\n\n` +
    `PROJECT INFORMATION\n` +
    `-------------------\n` +
    `Project name:        ${input.projectName}\n` +
    `Project location:    ${input.projectLocation}\n` +
    (input.projectNumber ? `Project number:      ${input.projectNumber}\n` : '') +
    `Awarding body:       ${input.awardingBodyName}\n` +
    (input.awardingBodyAddress ? `Awarding body addr:  ${input.awardingBodyAddress}\n` : '') +
    `Contract award date: ${input.awardDate}\n` +
    `Contract amount:     ${dollars}\n` +
    (input.estimatedStartDate ? `Estimated start:     ${input.estimatedStartDate}\n` : '') +
    (input.estimatedCompletionDate ? `Estimated completion: ${input.estimatedCompletionDate}\n` : '') +
    `\n` +
    `APPRENTICEABLE CRAFT\n` +
    `--------------------\n` +
    `Craft:               ${input.craft}\n` +
    `Estimated journey-level hours: ${input.estimatedJourneyHours ?? '(unknown)'}\n` +
    `Estimated apprentice hours:    ${input.estimatedApprenticeHours ?? '(unknown)'}\n\n` +
    `Pursuant to 8 CCR §230, the above-named contractor hereby notifies your\n` +
    `apprenticeship committee of the award of the public work contract described\n` +
    `above. The contractor will employ apprentices from your committee or, where\n` +
    `appropriate, will request dispatch in accordance with applicable rules.\n\n` +
    `Notification must be sent within 10 days of contract award.\n` +
    `Award date:        ${input.awardDate}\n` +
    `Notify-by date:    ${notifyByDate}\n\n` +
    `Date: __________________   By: ____________________________________\n` +
    `                                Authorized representative of ${input.contractorName}\n`;

  return { formText, notifyByDate, daysUntilDeadline };
}
