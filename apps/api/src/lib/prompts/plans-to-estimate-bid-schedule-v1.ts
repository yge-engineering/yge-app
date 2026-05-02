// Bid-schedule parser — v1.
//
// Second pass of the multi-pass Plans-to-Estimate orchestrator.
// Reads the agency's bid schedule (the table of itemized line
// items the contractor fills with unit prices) and extracts each
// row as a structured PtoEBidItem.
//
// Title-block context (passed in from pass 1) helps disambiguate
// the format — Caltrans bid schedules format slightly differently
// from county packets.

export const PROMPT_VERSION = 'plans-to-estimate-bid-schedule@1.0.0';

export const SYSTEM_PROMPT = [
  'You are extracting line items from a heavy civil construction bid',
  'schedule. The owner agency has already published a numbered list of',
  'items with descriptions, units, and quantities; your job is to',
  'pull each row faithfully — same itemNumber, same unit, same quantity.',
  '',
  'Critical: do NOT invent items. Do NOT roll multiple rows into one.',
  'Do NOT reorder. The bid form the contractor submits has to match',
  'the agency\'s schedule one-for-one or the bid is non-responsive.',
  '',
  'Confidence rule for the bid-schedule pass:',
  '  - HIGH: explicit row in the table, all fields readable',
  '  - MEDIUM: row visible but one field (usually quantity) is hard',
  '    to read or marked TBD',
  '  - LOW: row implied or marked "force account" / "T&M"',
  '',
  'Common units the agencies print (preserve verbatim if possible):',
  '  LS, LF, SF, SY, CY, EA, TON, ACRE, MILE, GAL, HR, MOBE, AS, AC',
  '',
  'Return your output by calling submit_bid_schedule exactly once.',
  'Do not respond in plain text.',
].join('\n');

export function buildUserMessage(args: {
  bidScheduleText: string;
  projectName?: string;
  ownerAgency?: string;
}): string {
  const ctx = [
    args.projectName ? `Project: ${args.projectName}` : '',
    args.ownerAgency ? `Owner: ${args.ownerAgency}` : '',
  ].filter(Boolean).join(' · ');
  return [
    ctx ? `Context: ${ctx}` : '',
    '',
    'Here is the bid schedule text. Pull every line item.',
    '',
    '--- BID SCHEDULE START ---',
    args.bidScheduleText,
    '--- BID SCHEDULE END ---',
  ].filter(Boolean).join('\n');
}

export const SUBMIT_TOOL_NAME = 'submit_bid_schedule';

export const SUBMIT_TOOL_INPUT_SCHEMA = {
  type: 'object',
  required: ['bidItems'],
  properties: {
    bidItems: {
      type: 'array',
      items: {
        type: 'object',
        required: ['itemNumber', 'description', 'unit', 'quantity', 'confidence'],
        properties: {
          itemNumber: { type: 'string' },
          description: { type: 'string' },
          unit: { type: 'string' },
          quantity: { type: 'number' },
          confidence: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
          notes: { type: 'string' },
          pageReference: { type: 'string' },
        },
      },
    },
  },
} as const;
