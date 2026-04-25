// Plans-to-Estimate service — wraps the Anthropic call and validates output.
// The endpoint is responsible for fetching files / extracting text; this layer
// only knows how to ask Claude for a draft and parse the result.

import type Anthropic from '@anthropic-ai/sdk';
import { anthropic, DEFAULT_MODEL } from '../lib/anthropic';
import { SYSTEM_PROMPT, buildUserMessage, PROMPT_VERSION } from '../lib/prompts/plans-to-estimate-v1';
import { PtoEOutputSchema, type PtoEOutput } from '@yge/shared';

export interface RunPlansToEstimateInput {
  documentText: string;
  sessionNotes?: string;
  /** Optional override — useful for tests. Defaults to the singleton client. */
  client?: Pick<typeof anthropic, 'messages'>;
  /** Optional override — defaults to claude-sonnet-4-6. */
  model?: string;
}

export interface RunPlansToEstimateResult {
  output: PtoEOutput;
  usage: { inputTokens: number; outputTokens: number };
  modelUsed: string;
  /** Version tag of the prompt that produced this draft. Persist alongside
   *  the Estimate row so we can correlate AI accuracy with prompt iterations. */
  promptVersion: string;
}

const SUBMIT_TOOL: Anthropic.Tool = {
  name: 'submit_draft_estimate',
  description:
    'Submit the draft estimate after reading the project document. Call this exactly once.',
  input_schema: {
    type: 'object',
    required: ['projectName', 'projectType', 'bidItems', 'overallConfidence'],
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
      location: { type: 'string' },
      ownerAgency: { type: 'string' },
      bidDueDate: { type: 'string' },
      prebidMeeting: { type: 'string' },
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
      assumptions: { type: 'array', items: { type: 'string' } },
      questionsForEstimator: { type: 'array', items: { type: 'string' } },
      overallConfidence: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
    },
  },
};

export class PlansToEstimateError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'PlansToEstimateError';
  }
}

export async function runPlansToEstimate(
  input: RunPlansToEstimateInput,
): Promise<RunPlansToEstimateResult> {
  if (!input.documentText || input.documentText.trim().length === 0) {
    throw new PlansToEstimateError('documentText is empty.');
  }

  const client = input.client ?? anthropic;
  const model = input.model ?? DEFAULT_MODEL;

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [SUBMIT_TOOL],
    tool_choice: { type: 'tool', name: SUBMIT_TOOL.name },
    messages: [{ role: 'user', content: buildUserMessage(input.documentText, input.sessionNotes) }],
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new PlansToEstimateError(
      'Model did not call submit_draft_estimate. Stop reason: ' + response.stop_reason,
    );
  }

  const parsed = PtoEOutputSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new PlansToEstimateError(
      `submit_draft_estimate output failed validation: ${parsed.error.message}`,
      toolUse.input,
    );
  }

  return {
    output: parsed.data,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
    modelUsed: model,
    promptVersion: PROMPT_VERSION,
  };
}
