// Stop-payment notice (CA Civ. Code §9350+).
//
// Public-works mechanism for a sub-tier claimant to freeze the prime
// contractor's retention with the awarding agency until the unpaid amount
// is resolved. Must be served on the agency within 90 days of completion
// of work as a whole (or 90 days after recordation of NOC if filed sooner).
// Once served, the agency MUST withhold 125% of the claimed amount from
// pending payments to the prime.

import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const StopPaymentInputSchema = z.object({
  /** Claimant — the sub-tier contractor (typically YGE). */
  claimantName: z.string().min(1).max(200),
  claimantAddress: z.string().min(1).max(400),
  claimantPhone: z.string().max(40).optional(),
  /** Party who hired the claimant (the prime or a higher-tier sub). */
  hiringPartyName: z.string().min(1).max(200),
  /** Prime contractor on the public job. */
  primeContractorName: z.string().min(1).max(200),
  /** Public agency (the owner). */
  publicAgencyName: z.string().min(1).max(200),
  publicAgencyAddress: z.string().max(400).optional(),
  /** Project description. */
  projectName: z.string().min(1).max(300),
  projectLocation: z.string().max(400).optional(),
  /** Description of the work / materials furnished. */
  workDescription: z.string().min(1).max(2_000),
  /** Total amount claimed (cents). The agency must withhold 125% of this. */
  amountClaimedCents: z.number().int().positive(),
  /** Date of last labor / materials. Sets the 90-day clock. */
  lastWorkDate: z.string().regex(ISO_DATE, 'Use yyyy-mm-dd'),
});
export type StopPaymentInput = z.infer<typeof StopPaymentInputSchema>;

export interface StopPaymentResult {
  /** Drafted notice text — plain text suitable for print / PDF / email body. */
  noticeText: string;
  /** Last legal date to serve the notice (yyyy-mm-dd). */
  serveByDate: string;
  /** Days until the serve-by deadline (negative if past). */
  daysUntilDeadline: number;
  /** 125% of amount claimed in cents — the amount the agency must withhold. */
  withholdAmountCents: number;
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

export function buildStopPaymentNotice(
  input: StopPaymentInput,
  today: string,
): StopPaymentResult {
  const last = parseISO(input.lastWorkDate);
  const serveByDate = addDays(last, 90);
  const todayDate = parseISO(today);
  const daysUntilDeadline = Math.round(
    (serveByDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  const withholdAmountCents = Math.round(input.amountClaimedCents * 1.25);
  const dollars = (input.amountClaimedCents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });

  const noticeText =
    `STOP-PAYMENT NOTICE\n` +
    `(California Civil Code §§9350–9510)\n\n` +
    `TO: ${input.publicAgencyName}\n` +
    (input.publicAgencyAddress ? `    ${input.publicAgencyAddress}\n` : '') +
    `\n` +
    `RE: Public Work of Improvement — ${input.projectName}\n` +
    (input.projectLocation ? `    Location: ${input.projectLocation}\n` : '') +
    `    Prime contractor: ${input.primeContractorName}\n\n` +
    `You are hereby notified that the undersigned claimant has furnished labor,\n` +
    `services, equipment, and/or materials for the above public work of improvement.\n\n` +
    `Claimant:           ${input.claimantName}\n` +
    `Claimant address:   ${input.claimantAddress}\n` +
    (input.claimantPhone ? `Claimant phone:     ${input.claimantPhone}\n` : '') +
    `Hiring party:       ${input.hiringPartyName}\n\n` +
    `Description of labor / materials furnished:\n` +
    `${input.workDescription}\n\n` +
    `The amount in value already furnished, plus any due and unpaid for the labor,\n` +
    `services, equipment, and/or materials furnished, is ${dollars}.\n\n` +
    `Pursuant to California Civil Code §9358, the public entity is hereby required\n` +
    `to withhold from the prime contractor sufficient funds to satisfy this claim,\n` +
    `plus reasonable costs of any litigation thereon. The amount to be withheld is\n` +
    `125% of the claim, or ${(withholdAmountCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}.\n\n` +
    `Date of last labor / materials furnished: ${input.lastWorkDate}\n` +
    `Notice must be served by:                 ${formatDate(serveByDate)} (Civ. Code §9356)\n\n` +
    `Verified under penalty of perjury under the laws of the State of California.\n\n` +
    `Dated: __________________      By: ____________________________________\n` +
    `                                    Authorized representative of ${input.claimantName}\n`;

  return {
    noticeText,
    serveByDate: formatDate(serveByDate),
    daysUntilDeadline,
    withholdAmountCents,
  };
}
