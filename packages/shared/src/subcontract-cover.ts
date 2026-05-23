// Subcontract cover-letter generator.
//
// Deterministic template that produces the standard YGE subcontract
// cover letter when sending a subcontract package to a sub. Pairs
// well with the email-reply-template module (which handles the
// transmittal email).
//
// Output includes the standard YGE clauses every cover letter
// repeats: insurance + lien-waiver + safety + retention. Caller
// adjusts dollar amounts, scope, and the sub-specific blanks; the
// regulatory/citation language is baked in.
//
// Pure: no side effects.

import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const SubcontractCoverInputSchema = z.object({
  /** YGE job context. */
  projectName: z.string().min(1).max(300),
  projectNumber: z.string().max(120).optional(),
  ownerAgency: z.string().max(200).optional(),
  /** Sub identity. */
  subName: z.string().min(1).max(300),
  subContactName: z.string().min(1).max(200),
  subAddress: z.string().min(1).max(400),
  /** Scope description — one short paragraph. */
  scopeDescription: z.string().min(1).max(2000),
  /** Dollar amount of the subcontract (cents). */
  contractAmountCents: z.number().int().nonnegative(),
  /** Retention percentage withheld (decimal, e.g. 0.05 = 5%). */
  retentionPct: z.number().nonnegative().default(0.05),
  /** Date the cover letter is dated (yyyy-mm-dd). */
  letterDate: z.string().regex(ISO_DATE, 'Use yyyy-mm-dd'),
  /** Required start date on site (yyyy-mm-dd). */
  startDate: z.string().regex(ISO_DATE).optional(),
  /** Whether this is a public-works job (drives PW language). */
  prevailingWage: z.boolean().default(false),
  /** Signer info. */
  ourSignerName: z.string().min(1).max(120),
  ourSignerTitle: z.string().min(1).max(120),
});
export type SubcontractCoverInput = z.infer<typeof SubcontractCoverInputSchema>;

export interface SubcontractCoverDraft {
  /** Letter body — plain text. */
  body: string;
  /** Bullet list of what the sub must return (for the email transmittal). */
  enclosureList: string[];
}

const STANDARD_ENCLOSURES = [
  'Signed subcontract (all pages)',
  'Certificate of Insurance naming YGE + project owner as additional insured',
  'W-9',
  'Workers comp + GL endorsement pages',
  'Safety plan + JSA template for your trade',
];

export function buildSubcontractCover(
  input: SubcontractCoverInput,
): SubcontractCoverDraft {
  const dollars = (input.contractAmountCents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const retentionPctLabel = (input.retentionPct * 100).toFixed(0);
  const startLine = input.startDate
    ? `Anticipated start on site: ${input.startDate}.\n`
    : '';
  const agencyLine = input.ownerAgency
    ? `Owner / awarding agency: ${input.ownerAgency}.\n`
    : '';
  const projectNumberLine = input.projectNumber
    ? `Project number: ${input.projectNumber}.\n`
    : '';
  const pwClause = input.prevailingWage
    ? [
        '',
        'PUBLIC WORKS — CA Labor Code §1720 et seq.',
        'This is a California public-works project. The sub must:',
        '  - Pay the applicable DIR prevailing wage rates for every craft on site.',
        '  - File weekly Certified Payroll Reports (CPRs) through the DIR eCPR portal.',
        '  - Verify DIR contractor registration is current (sub + every lower-tier sub).',
        '  - Comply with apprenticeship requirements (DAS-140 / DAS-142 as applicable).',
      ].join('\n')
    : '';

  const enclosures = STANDARD_ENCLOSURES.map((s, i) => `  ${i + 1}. ${s}`).join('\n');

  const body = [
    `${input.letterDate}`,
    '',
    `${input.subName}`,
    `Attn: ${input.subContactName}`,
    `${input.subAddress}`,
    '',
    `Re: ${input.projectName}`,
    '',
    `Dear ${input.subContactName.split(/\s+/)[0] ?? input.subContactName},`,
    '',
    `Enclosed is the subcontract for your work on the project referenced above.`,
    '',
    'Project context:',
    `Project name: ${input.projectName}.`,
    agencyLine ? agencyLine.trimEnd() : '',
    projectNumberLine ? projectNumberLine.trimEnd() : '',
    `Subcontract amount: $${dollars}.`,
    `Retention: ${retentionPctLabel}% withheld until project closeout.`,
    startLine ? startLine.trimEnd() : '',
    '',
    'Scope of work:',
    input.scopeDescription,
    '',
    'Standard YGE subcontract terms (every package):',
    '  - Insurance certificates must arrive BEFORE work begins on site. GL ≥ $2M aggregate,',
    '    Workers Comp per CA Labor Code, Auto ≥ $1M, naming YGE + the project owner as',
    '    additional insured (additional-insured endorsement copy required, not just a COI).',
    '  - Conditional lien waiver due with every progress invoice; unconditional waiver',
    '    follows payment per CA Civ. Code §8132 et seq.',
    '  - On-site safety: written IIPP + heat-illness program; daily JSA for the trade;',
    '    comply with all YGE site rules including 100% PPE.',
    '  - Indemnify YGE for any claim arising from the sub\'s scope per CA Civ. §2782.05.',
    pwClause,
    '',
    'Please sign + return all pages with the enclosures listed below.',
    '',
    `${input.ourSignerName}`,
    `${input.ourSignerTitle}, Young General Engineering, Inc.`,
    '',
    'Enclosures the sub must return:',
    enclosures,
  ]
    .filter((line) => line !== '')
    .join('\n')
    // Compact triple-or-more blank lines into a single blank line.
    .replace(/\n{2,}/g, '\n\n');

  return {
    body,
    enclosureList: [...STANDARD_ENCLOSURES],
  };
}
