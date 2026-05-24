// Plans-to-Estimate service — wraps the Anthropic call and validates output.
// The endpoint is responsible for fetching files / extracting text; this layer
// only knows how to ask Claude for a draft and parse the result.

// SDK 0.20.9's exported types are too thin for tool use. Drop the
// type-only namespace import and just structurally type SUBMIT_TOOL —
// the runtime call still goes through the typed `anthropic` client.
import { anthropic, DEFAULT_MODEL } from '../lib/anthropic';
import { SYSTEM_PROMPT, buildUserMessage, PROMPT_VERSION } from '../lib/prompts/plans-to-estimate-v1';
import { PtoEOutputSchema, sumPtoEBidTotalCents, type PtoEOutput } from '@yge/shared';

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

interface SubmitTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

const SUBMIT_TOOL: SubmitTool = {
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
            // Market-priced unit cost in cents. All-in (labor + equip +
            // material + 20% O&P unless flagged in priceSourceNote).
            estimatedUnitPriceCents: { type: 'integer', minimum: 0 },
            // quantity × estimatedUnitPriceCents at output time.
            estimatedLineTotalCents: { type: 'integer', minimum: 0 },
            // Where the price came from: HIGH = local recent comparable,
            // MEDIUM = California regional average, LOW = generic.
            priceSourceConfidence: {
              type: 'string',
              enum: ['HIGH', 'MEDIUM', 'LOW'],
            },
            // One-line rationale ("Caltrans 2024-2026 avg for Class 2
            // base", "similar 2024 won bid"). Forces a price stance.
            priceSourceNote: { type: 'string' },
          },
        },
      },
      assumptions: { type: 'array', items: { type: 'string' } },
      questionsForEstimator: { type: 'array', items: { type: 'string' } },
      overallConfidence: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
      // Roll-up across bidItems. The service backfills this when the
      // model forgets, so the UI always has a total.
      estimatedBidTotalCents: { type: 'integer', minimum: 0 },
    },
  },
};

export class PlansToEstimateError extends Error {
  // `cause` exists on the modern Error type; declare with `override` and keep
  // it as a regular field rather than a parameter property so we satisfy
  // tsconfig's noImplicitOverride.
  public override readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'PlansToEstimateError';
    this.cause = cause;
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

  // NOTE: @anthropic-ai/sdk@0.20.9 (pinned via lockfile) ships incomplete
  // tool-use types — `tools`/`tool_choice` aren't on MessageCreateParamsBase,
  // ToolUseBlock isn't discriminated from TextBlock, and the response union
  // includes Stream<MessageStreamEvent> with no `usage`/`content`/`stop_reason`.
  // Everything works at runtime; we cast both sides through any so typecheck
  // passes. When we bump the SDK these casts can come out.
  const createParams: any = {
    model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [SUBMIT_TOOL],
    tool_choice: { type: 'tool', name: SUBMIT_TOOL.name },
    messages: [{ role: 'user', content: buildUserMessage(input.documentText, input.sessionNotes) }],
  };
  const response: any = await client.messages.create(createParams);

  const toolUse = response.content.find(
    (b: { type: string }) => b.type === 'tool_use',
  ) as { type: 'tool_use'; input: unknown } | undefined;
  if (!toolUse) {
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

  // Backfill any missing per-line totals (quantity × unit price) +
  // the grand total. The model is supposed to set these but we
  // recompute defensively so the UI always has consistent numbers.
  const bidItems = parsed.data.bidItems.map((item) => {
    if (item.estimatedUnitPriceCents === undefined) return item;
    const computed = Math.round(item.quantity * item.estimatedUnitPriceCents);
    return {
      ...item,
      estimatedLineTotalCents: item.estimatedLineTotalCents ?? computed,
    };
  });
  const grand = sumPtoEBidTotalCents(bidItems);
  const enriched: PtoEOutput = {
    ...parsed.data,
    bidItems,
    estimatedBidTotalCents:
      grand > 0 ? grand : parsed.data.estimatedBidTotalCents,
  };

  return {
    output: enriched,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
    modelUsed: model,
    promptVersion: PROMPT_VERSION,
  };
}
