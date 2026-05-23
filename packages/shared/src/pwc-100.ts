// CA PWC-100 — Public Works Project Registration (8 CCR §16451).
//
// Awarding bodies must register every public-works project with DIR before
// the award (or within 5 days of award if they don't pre-register). YGE
// commonly drafts it for the agency. Helper builds the structured form data
// + the 5-day deadline.

import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const Pwc100InputSchema = z.object({
  /** Awarding body. */
  awardingBodyName: z.string().min(1).max(300),
  awardingBodyAddress: z.string().max(400).optional(),
  awardingBodyContact: z.string().max(200).optional(),
  awardingBodyPhone: z.string().max(40).optional(),
  awardingBodyEmail: z.string().max(120).optional(),

  /** Prime contractor (often YGE). */
  primeContractorName: z.string().min(1).max(300),
  primeContractorAddress: z.string().min(1).max(400),
  primeContractorCslb: z.string().max(40),
  primeContractorDir: z.string().max(40),

  /** Project. */
  projectName: z.string().min(1).max(300),
  projectLocation: z.string().min(1).max(400),
  projectCounty: z.string().max(120).optional(),
  /** Brief description of work. */
  projectDescription: z.string().min(1).max(2_000),
  /** Total contract amount in cents. */
  contractAmountCents: z.number().int().positive(),

  /** Date the contract was advertised for bid (optional). */
  bidAdvertisedDate: z.string().regex(ISO_DATE).optional(),
  /** Bid opening date (optional). */
  bidOpenedDate: z.string().regex(ISO_DATE).optional(),
  /** Award date — sets the 5-day registration deadline. */
  awardDate: z.string().regex(ISO_DATE, 'Use yyyy-mm-dd'),
  /** Estimated start + completion. */
  estimatedStartDate: z.string().regex(ISO_DATE).optional(),
  estimatedCompletionDate: z.string().regex(ISO_DATE).optional(),
});
export type Pwc100Input = z.infer<typeof Pwc100InputSchema>;

export interface Pwc100Result {
  formText: string;
  /** Deadline = awardDate + 5 days. */
  registerByDate: string;
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

export function buildPwc100(input: Pwc100Input, today: string): Pwc100Result {
  const registerByDate = formatDate(addDays(parseISO(input.awardDate), 5));
  const daysUntilDeadline = Math.round(
    (parseISO(registerByDate).getTime() - parseISO(today).getTime()) /
      (1000 * 60 * 60 * 24),
  );
  const dollars = (input.contractAmountCents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });

  const formText =
    `CALIFORNIA DEPARTMENT OF INDUSTRIAL RELATIONS\n` +
    `PUBLIC WORKS PROJECT REGISTRATION (PWC-100)\n` +
    `(Required by 8 CCR §16451; due before award or within 5 days of award)\n\n` +
    `AWARDING BODY\n` +
    `-------------\n` +
    `Name:    ${input.awardingBodyName}\n` +
    (input.awardingBodyAddress ? `Address: ${input.awardingBodyAddress}\n` : '') +
    (input.awardingBodyContact ? `Contact: ${input.awardingBodyContact}\n` : '') +
    (input.awardingBodyPhone ? `Phone:   ${input.awardingBodyPhone}\n` : '') +
    (input.awardingBodyEmail ? `Email:   ${input.awardingBodyEmail}\n` : '') +
    `\n` +
    `PRIME CONTRACTOR\n` +
    `----------------\n` +
    `Name:           ${input.primeContractorName}\n` +
    `Address:        ${input.primeContractorAddress}\n` +
    `CSLB License:   ${input.primeContractorCslb}\n` +
    `DIR PWC Reg #:  ${input.primeContractorDir}\n\n` +
    `PROJECT\n` +
    `-------\n` +
    `Project name:        ${input.projectName}\n` +
    `Project location:    ${input.projectLocation}\n` +
    (input.projectCounty ? `County:              ${input.projectCounty}\n` : '') +
    `Contract amount:     ${dollars}\n` +
    (input.bidAdvertisedDate ? `Bid advertised:      ${input.bidAdvertisedDate}\n` : '') +
    (input.bidOpenedDate ? `Bid opened:          ${input.bidOpenedDate}\n` : '') +
    `Contract awarded:    ${input.awardDate}\n` +
    (input.estimatedStartDate ? `Estimated start:     ${input.estimatedStartDate}\n` : '') +
    (input.estimatedCompletionDate ? `Estimated completion: ${input.estimatedCompletionDate}\n` : '') +
    `\n` +
    `Description of work:\n` +
    `${input.projectDescription}\n\n` +
    `REGISTRATION DEADLINE\n` +
    `---------------------\n` +
    `Award date:       ${input.awardDate}\n` +
    `Register by:      ${registerByDate} (5 days post-award)\n\n` +
    `Date: __________________  By: ____________________________________\n` +
    `                              Authorized representative\n`;

  return { formText, registerByDate, daysUntilDeadline };
}
