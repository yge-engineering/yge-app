// Title-block reader — v1.
//
// Reads page 1 / front matter of a plan set and extracts the
// project-level metadata: name, type, owner agency, location,
// bid due date, mandatory pre-bid meeting (if any).
//
// Used as the first pass of the multi-pass Plans-to-Estimate
// orchestrator. Output feeds the second pass (bid-schedule
// parser) so it has agency context to disambiguate format.

export const PROMPT_VERSION = 'plans-to-estimate-title-block@1.0.0';

export const SYSTEM_PROMPT = [
  'You are reading the title block / front matter of a heavy civil',
  'construction plan set or RFP. Your job is to extract the project-',
  'level metadata that downstream passes (bid-schedule parser, spec',
  'reader, cost-code matcher) will need.',
  '',
  'Be conservative — if a field is genuinely missing from the page,',
  'leave it out rather than guess. Most title blocks are noisy; pull',
  'only what is clearly the answer.',
  '',
  'Heavy civil project type taxonomy (pick the closest):',
  '  - ROAD_RECONSTRUCTION (paving, overlay, pavement rehabilitation)',
  '  - DRAINAGE (culverts, storm drains, headwalls)',
  '  - BRIDGE (bridge replacement, retrofit, new construction)',
  '  - GRADING (mass earthwork, site preparation)',
  '  - FIRE_FUEL_REDUCTION (CAL FIRE thinning, mastication, chipping)',
  '  - OTHER (anything that doesn\'t cleanly fit)',
  '',
  'CA agency naming conventions:',
  '  - "Caltrans" or "California Department of Transportation"',
  '  - "CAL FIRE" or "California Department of Forestry and Fire Protection"',
  '  - County-level public works depts: "[County name] County DPW"',
  '  - Cities: "City of [name]"',
  '',
  'Return your output by calling submit_title_block_metadata',
  'exactly once. Do not respond in plain text.',
].join('\n');

export function buildUserMessage(titleBlockText: string): string {
  return [
    'Here is the title-block / front-matter text. Extract the project',
    'metadata.',
    '',
    '--- TITLE BLOCK START ---',
    titleBlockText,
    '--- TITLE BLOCK END ---',
  ].join('\n');
}

export const SUBMIT_TOOL_NAME = 'submit_title_block_metadata';

export const SUBMIT_TOOL_INPUT_SCHEMA = {
  type: 'object',
  required: ['projectName', 'projectType'],
  properties: {
    projectName: { type: 'string' },
    projectType: {
      type: 'string',
      enum: [
        'ROAD_RECONSTRUCTION',
        'DRAINAGE',
        'BRIDGE',
        'GRADING',
        'FIRE_FUEL_REDUCTION',
        'OTHER',
      ],
    },
    location: { type: 'string', description: 'County, route, station range' },
    ownerAgency: { type: 'string' },
    bidDueDate: { type: 'string', description: 'yyyy-mm-dd or as printed' },
    prebidMeeting: {
      type: 'string',
      description: 'When + where + mandatory/optional flag, free-form',
    },
    contractNumber: { type: 'string', description: 'Agency contract / project #' },
  },
} as const;
