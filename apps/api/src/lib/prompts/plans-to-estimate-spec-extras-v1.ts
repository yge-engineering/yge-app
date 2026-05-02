// Spec-extras pass — v1.
//
// Third pass of the multi-pass Plans-to-Estimate orchestrator.
// Reads the technical specification text and surfaces work items
// the agency expects but DIDN'T put on the printed bid schedule.
// Common cases:
//   - "Mobilization included in Item 1" — but the spec says
//     mob is its own line
//   - Traffic control treated as incidental in the schedule, but
//     the spec calls for a stand-alone TCP submittal worth a line
//   - Special conditions (haul-off restrictions, dust control,
//     night work) that materially change quantities or add lines
//
// Distinct from the standalone /scope-gap endpoint (bundle 595)
// which compares a FULL draft against specs. This pass runs DURING
// the draft generation and lets the orchestrator add items the
// printed schedule omits.

export const PROMPT_VERSION = 'plans-to-estimate-spec-extras@1.0.0';

export const SYSTEM_PROMPT = [
  'You are reading the technical specifications of a heavy civil',
  'construction project, looking for items the agency expects but did',
  'NOT put on the printed bid schedule. Your output augments the bid',
  'schedule with these missing items so the contractor\'s bid covers',
  'the full required scope.',
  '',
  'Be conservative — only add items the spec explicitly requires AND',
  'are absent from the schedule. Don\'t duplicate items that already',
  'appear on the schedule with a different name.',
  '',
  'Common spec-required items often missing from agency schedules:',
  '  - Mobilization (when not already a numbered line)',
  '  - Traffic control / signing (when called incidental but valued',
  '    by the spec)',
  '  - SWPPP / NPDES erosion control on >1-acre disturbance',
  '  - Dust control / water truck (CA grading projects)',
  '  - Haul-off / stockpile restrictions (private property,',
  '    designated yards)',
  '  - Night work / weekend work premiums',
  '  - As-built drawings (CAL FIRE / Caltrans require these)',
  '  - Project record signage',
  '',
  'YGE conventions:',
  '  - Outside trucking is direct cost, not a sub.',
  '  - "Incidental" items still need their own line if their cost is',
  '    non-trivial (>$5k).',
  '',
  'Return your output by calling submit_spec_extras exactly once.',
  'Do not respond in plain text.',
].join('\n');

export function buildUserMessage(args: {
  specText: string;
  scheduleSummary: string;
  projectType?: string;
}): string {
  return [
    args.projectType ? `Project type: ${args.projectType}` : '',
    '',
    'These items already appear on the printed bid schedule (skip',
    'duplicates):',
    '',
    '--- ALREADY ON SCHEDULE ---',
    args.scheduleSummary,
    '--- ALREADY ON SCHEDULE END ---',
    '',
    'Here is the spec text. Surface every work item the spec requires',
    'that is NOT already on the schedule.',
    '',
    '--- SPECIFICATIONS START ---',
    args.specText,
    '--- SPECIFICATIONS END ---',
  ].filter(Boolean).join('\n');
}

export const SUBMIT_TOOL_NAME = 'submit_spec_extras';

export const SUBMIT_TOOL_INPUT_SCHEMA = {
  type: 'object',
  required: ['extras', 'assumptions'],
  properties: {
    extras: {
      type: 'array',
      description: 'Bid items the spec requires but the schedule omits.',
      items: {
        type: 'object',
        required: ['description', 'unit', 'quantity', 'confidence', 'specReference'],
        properties: {
          description: { type: 'string' },
          unit: { type: 'string' },
          quantity: { type: 'number' },
          confidence: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
          specReference: {
            type: 'string',
            description: 'Spec section or paragraph that calls for the item',
          },
          notes: { type: 'string' },
        },
      },
    },
    assumptions: {
      type: 'array',
      items: { type: 'string' },
      description: 'Reading-level assumptions the estimator should review.',
    },
    questionsForEstimator: {
      type: 'array',
      items: { type: 'string' },
      description: 'Open questions the spec leaves ambiguous.',
    },
  },
} as const;
