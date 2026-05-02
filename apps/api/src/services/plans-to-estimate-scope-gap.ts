// Scope-gap check service. Given a draft estimate JSON + spec text,
// runs the scope-gap prompt and validates the response shape.

import { anthropic, DEFAULT_MODEL } from '../lib/anthropic';
import {
  PROMPT_VERSION,
  SUBMIT_TOOL_INPUT_SCHEMA,
  SUBMIT_TOOL_NAME,
  SYSTEM_PROMPT,
  buildUserMessage,
} from '../lib/prompts/plans-to-estimate-scope-gap-v1';
import { ScopeGapReportSchema, type ScopeGapReport } from '@yge/shared';

export interface RunScopeGapInput {
  /** Stringified PtoEOutput / PricedEstimate JSON. The prompt
   *  consumes it as text — the JSON shape is opaque to the model. */
  draftJson: string;
  /** Spec text (RFP, technical specifications, addenda body). */
  specText: string;
  client?: Pick<typeof anthropic, 'messages'>;
  model?: string;
}

export interface RunScopeGapResult {
  report: ScopeGapReport;
  usage: { inputTokens: number; outputTokens: number };
  modelUsed: string;
  promptVersion: string;
}

export class ScopeGapError extends Error {
  public override readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'ScopeGapError';
    this.cause = cause;
  }
}

export async function runScopeGap(input: RunScopeGapInput): Promise<RunScopeGapResult> {
  if (!input.draftJson?.trim()) throw new ScopeGapError('draftJson is empty.');
  if (!input.specText?.trim()) throw new ScopeGapError('specText is empty.');

  const client = input.client ?? anthropic;
  const model = input.model ?? DEFAULT_MODEL;

  // SDK 0.20.9 ships incomplete tool-use types — same any-cast
  // workaround as plans-to-estimate.ts. Remove when the SDK bumps.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createParams: any = {
    model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: SUBMIT_TOOL_NAME,
        description: 'Submit the scope-gap report after reading the spec text.',
        input_schema: SUBMIT_TOOL_INPUT_SCHEMA,
      },
    ],
    tool_choice: { type: 'tool', name: SUBMIT_TOOL_NAME },
    messages: [
      {
        role: 'user',
        content: buildUserMessage({
          draftJson: input.draftJson,
          specText: input.specText,
        }),
      },
    ],
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response: any = await client.messages.create(createParams);

  const toolUse = response.content.find(
    (b: { type: string }) => b.type === 'tool_use',
  ) as { type: 'tool_use'; input: unknown } | undefined;
  if (!toolUse) {
    throw new ScopeGapError(
      'Model did not call submit_scope_gap_report. Stop reason: ' + response.stop_reason,
    );
  }

  const parsed = ScopeGapReportSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new ScopeGapError(
      `submit_scope_gap_report output failed validation: ${parsed.error.message}`,
      toolUse.input,
    );
  }

  return {
    report: parsed.data,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
    modelUsed: model,
    promptVersion: PROMPT_VERSION,
  };
}
