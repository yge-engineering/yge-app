// Plans-to-Estimate scope-gap check — v1.
//
// Runs against a draft estimate + the spec text. Flags items the
// specs mention that the draft estimate doesn't cover. Mirrors the
// project plan v6.3 'AI scope-gap check on the spec set at bid
// intake' — catches the kind of miss that turns a winning bid into
// a losing one (pavement striping called for in the spec but not
// in the draft, traffic control plan referenced but no line item).

export const PROMPT_VERSION = 'plans-to-estimate-scope-gap@1.0.0';

export const SYSTEM_PROMPT = [
  'You are a senior heavy civil estimator reviewing a draft estimate for missed',
  'scope. Young General Engineering (YGE) just produced a draft from the plan',
  'set; your job is to read the technical specifications carefully and flag',
  'every item the specs require that the draft estimate does not cover.',
  '',
  'Be specific:',
  '- Quote the spec section / paragraph that calls for the work.',
  '- Name the bid item that should exist (or the existing item that needs a',
  '  quantity adjustment).',
  '- Estimate severity: HIGH (would clearly under-bid; e.g. spec calls for',
  '  signing, no signing line in draft), MEDIUM (likely missing but might be',
  '  rolled into another item), LOW (clarification rather than a hole).',
  '',
  'YGE\'s estimating conventions:',
  '- Mobilization is always a line item — flag if missing.',
  '- Traffic control is its own line on Caltrans / county jobs — never roll',
  '  it into another item.',
  '- SWPPP / erosion control is its own line on every project that disturbs',
  '  more than 1 acre.',
  '- Outside trucking is direct cost, not a sub.',
  '- Items the spec calls "incidental" still need their own line if their',
  '  cost is non-trivial (the agency uses "incidental" loosely).',
  '',
  'Skip non-issues. Bid coaches that fire on every line item train estimators',
  'to ignore them. If the draft truly covers the spec, return an empty gaps',
  'array and overallStatus="CLEAN".',
  '',
  'Return your output by calling submit_scope_gap_report exactly once.',
  'Do not respond in plain text.',
].join('\n');

export function buildUserMessage(args: {
  draftJson: string;
  specText: string;
}): string {
  return [
    'Review this draft estimate against the spec text. Call submit_scope_gap_report',
    'with every gap you find.',
    '',
    '--- DRAFT ESTIMATE (JSON) ---',
    args.draftJson,
    '--- DRAFT ESTIMATE END ---',
    '',
    '--- SPECIFICATIONS ---',
    args.specText,
    '--- SPECIFICATIONS END ---',
  ].join('\n');
}

export const SUBMIT_TOOL_NAME = 'submit_scope_gap_report';

export const SUBMIT_TOOL_INPUT_SCHEMA = {
  type: 'object',
  required: ['overallStatus', 'gaps'],
  properties: {
    overallStatus: {
      type: 'string',
      enum: ['CLEAN', 'MINOR_GAPS', 'MAJOR_GAPS'],
      description:
        'CLEAN when nothing material is missing; MINOR_GAPS when only LOW-severity items; MAJOR_GAPS otherwise.',
    },
    summary: {
      type: 'string',
      description:
        'One- or two-sentence plain-English read of the gap profile. Empty when overallStatus=CLEAN.',
    },
    gaps: {
      type: 'array',
      items: {
        type: 'object',
        required: ['severity', 'category', 'message'],
        properties: {
          severity: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
          category: {
            type: 'string',
            enum: [
              'MISSING_LINE',
              'QUANTITY_LOW',
              'UNIT_WRONG',
              'INCIDENTAL_NOT_LINED',
              'SCOPE_AMBIGUOUS',
              'OTHER',
            ],
          },
          message: {
            type: 'string',
            description: 'Plain-English description of the gap.',
          },
          specReference: {
            type: 'string',
            description: 'Spec section / paragraph that calls for the work, when known.',
          },
          suggestedItemNumber: {
            type: 'string',
            description: "If a new bid item is suggested, the itemNumber to use (matches the agency's bid schedule numbering when present).",
          },
          suggestedDescription: {
            type: 'string',
            description: 'One-line plain-English description of the suggested item.',
          },
          suggestedUnit: {
            type: 'string',
            description: 'LF / SF / CY / EA / TON / LS / etc.',
          },
          suggestedQuantity: { type: 'number' },
          existingItemNumber: {
            type: 'string',
            description: 'When the gap is a quantity-low / unit-wrong correction, the existing draft itemNumber to adjust.',
          },
        },
      },
    },
  },
} as const;
