// W-9 chase email generator.
//
// /vendor-w9-chase already lists vendors missing a W-9 with YTD
// spend. Office still has to write the chase email by hand. This
// helper does that — given the vendor + the YGE signer info,
// returns a plain-text email body that:
//   - states the IRS reason (we issue a 1099-NEC at year end)
//   - tells the vendor what we need (W-9 PDF, attached or replied)
//   - tells them how to send it (reply / fax / portal upload)
//   - explains the consequence (24% backup withholding) when the
//     vendor has been asked once before (`secondNotice = true`)
//
// Pure: deterministic plain text, no AI. Pairs with the existing
// email-reply-template module.

import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const W9ChaseInputSchema = z.object({
  vendorName: z.string().min(1).max(200),
  vendorContactName: z.string().max(120).optional(),
  vendorEmail: z.string().max(160).optional(),
  /** YTD payments made to the vendor so far this calendar year (cents). */
  ytdPaymentsCents: z.number().int().nonnegative(),
  /** True when this is the SECOND ask. Cranks up the urgency + adds
   *  the 24% backup-withholding warning per IRC §3406. */
  secondNotice: z.boolean().default(false),
  /** Today, yyyy-mm-dd. */
  asOfDate: z.string().regex(ISO_DATE, 'Use yyyy-mm-dd'),
  /** YGE signer info — same shape as the email-reply-template. */
  ourSignerName: z.string().min(1).max(120),
  ourSignerTitle: z.string().min(1).max(120),
  ourPhone: z.string().min(1).max(40),
  ourEmail: z.string().min(1).max(120),
  /** Optional secure upload link the vendor can use instead of email. */
  uploadUrl: z.string().max(800).optional(),
});
export type W9ChaseInput = z.infer<typeof W9ChaseInputSchema>;

export interface W9ChaseDraft {
  subject: string;
  body: string;
}

const BACKUP_WITHHOLDING_PCT = 24;

export function buildW9ChaseEmail(input: W9ChaseInput): W9ChaseDraft {
  const firstName = input.vendorContactName?.split(/\s+/)[0] ?? '';
  const greeting = firstName ? `Hi ${firstName},` : `Hi there,`;
  const ytdDollars = (input.ytdPaymentsCents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const uploadLine = input.uploadUrl
    ? `If easier, you can upload it here: ${input.uploadUrl}\n\n`
    : '';
  const secondLines = input.secondNotice
    ? [
        '',
        `This is a second request. Per IRS rules (IRC §3406), if we don't have a current W-9 on file we are required to begin BACKUP WITHHOLDING of ${BACKUP_WITHHOLDING_PCT}% on every future payment to ${input.vendorName} until the form is on file. We'd rather not — please send the W-9 this week so we can keep cutting full checks.`,
      ].join('\n')
    : '';

  const subject = input.secondNotice
    ? `Second request: W-9 needed for ${input.vendorName}`
    : `W-9 needed for ${input.vendorName} (year-end 1099)`;

  const body = [
    greeting,
    '',
    `We've paid ${input.vendorName} $${ytdDollars} YTD ${input.asOfDate.slice(0, 4)}. To issue your 1099-NEC at year-end we need a current W-9 on file.`,
    '',
    `Could you please reply with a signed W-9 (PDF or photo). The blank form is at https://www.irs.gov/pub/irs-pdf/fw9.pdf.`,
    '',
    uploadLine.trimEnd(),
    secondLines,
    '',
    'Thanks,',
    '',
    `${input.ourSignerName}`,
    `${input.ourSignerTitle}, Young General Engineering, Inc.`,
    `${input.ourPhone} · ${input.ourEmail}`,
  ]
    .filter((line) => line !== '')
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');

  return { subject, body };
}
