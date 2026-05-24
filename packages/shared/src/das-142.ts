// CA DAS-142 — Request for Dispatch of Apprentices.
//
// 8 CCR §230.1: when a public-works contractor needs apprentices in an
// approved craft, the request goes to the local JATC at least 72 hours
// before they're needed (excluding Saturdays, Sundays, and holidays).
// Different from DAS-140 (the contract-award notification): DAS-142 is
// an actual dispatch request for specific people on specific dates.

import { z } from 'zod';
// 72-hour rule = 3 business days back. Use the CA-holiday-aware helper
// so the math doesn't quietly schedule the latest send date on top of a
// state holiday (Memorial Day, Cesar Chavez, etc).
import { subtractBusinessDays } from './california-holidays';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const Das142InputSchema = z.object({
  contractorName: z.string().min(1).max(300),
  contractorAddress: z.string().min(1).max(400),
  contractorPhone: z.string().max(40).optional(),
  contractorCslb: z.string().max(40),
  contractorDir: z.string().max(40),

  projectName: z.string().min(1).max(300),
  projectLocation: z.string().min(1).max(400),

  craft: z.string().min(1).max(120),
  /** Number of apprentices requested. */
  numberOfApprentices: z.number().int().positive(),
  /** Date apprentices are needed on-site (yyyy-mm-dd). */
  neededByDate: z.string().regex(ISO_DATE, 'Use yyyy-mm-dd'),
  /** Estimated duration in days. */
  estimatedDurationDays: z.number().int().positive().optional(),
  reportToAddress: z.string().min(1).max(400),
  reportToContact: z.string().min(1).max(200),

  jatcName: z.string().min(1).max(300),
  jatcAddress: z.string().min(1).max(400),
});
export type Das142Input = z.infer<typeof Das142InputSchema>;

export interface Das142Result {
  formText: string;
  /** Earliest date this request was sent in compliance with the 72-hour rule. */
  earliestComplianceDate: string;
  /** Days of notice given (today vs neededByDate). Negative = past. */
  noticeDaysGiven: number;
}

function parseISO(s: string): Date {
  return new Date(s + 'T00:00:00Z');
}
function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function buildDas142(input: Das142Input, today: string): Das142Result {
  const needed = parseISO(input.neededByDate);
  // 72 business hours = 3 business days back from neededByDate. The
  // helper handles weekends + CA-observed holidays so the answer is
  // never a Memorial Day / Christmas Eve / etc.
  const earliest = parseISO(
    subtractBusinessDays(input.neededByDate, 3),
  );
  const todayDate = parseISO(today);
  const noticeDaysGiven = Math.round(
    (needed.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  const formText =
    `CALIFORNIA DEPARTMENT OF INDUSTRIAL RELATIONS\n` +
    `DIVISION OF APPRENTICESHIP STANDARDS\n` +
    `REQUEST FOR DISPATCH OF APPRENTICES (DAS-142)\n` +
    `(Required by 8 CCR §230.1; minimum 72-hour notice excluding weekends/holidays)\n\n` +
    `TO:    ${input.jatcName}\n` +
    `       ${input.jatcAddress}\n\n` +
    `FROM:  ${input.contractorName}\n` +
    `       ${input.contractorAddress}\n` +
    (input.contractorPhone ? `       Phone: ${input.contractorPhone}\n` : '') +
    `       CSLB License:  ${input.contractorCslb}\n` +
    `       DIR PWC Reg #: ${input.contractorDir}\n\n` +
    `PROJECT\n` +
    `-------\n` +
    `Project name:        ${input.projectName}\n` +
    `Project location:    ${input.projectLocation}\n\n` +
    `DISPATCH REQUEST\n` +
    `----------------\n` +
    `Craft:                 ${input.craft}\n` +
    `Apprentices needed:    ${input.numberOfApprentices}\n` +
    `Needed by:             ${input.neededByDate}\n` +
    (input.estimatedDurationDays ? `Estimated duration:    ${input.estimatedDurationDays} days\n` : '') +
    `Report-to address:     ${input.reportToAddress}\n` +
    `Report-to contact:     ${input.reportToContact}\n\n` +
    `Pursuant to 8 CCR §230.1, the above-named contractor hereby requests dispatch\n` +
    `of apprentices from your committee in the craft listed above. Minimum 72-hour\n` +
    `notice (excluding weekends and holidays) is observed.\n\n` +
    `Earliest 72-hour-compliant request date: ${formatDate(earliest)}\n\n` +
    `Date: __________________  By: ____________________________________\n` +
    `                              Authorized representative of ${input.contractorName}\n`;

  return {
    formText,
    earliestComplianceDate: formatDate(earliest),
    noticeDaysGiven,
  };
}
