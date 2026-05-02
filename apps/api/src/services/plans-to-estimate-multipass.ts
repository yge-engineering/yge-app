// Multi-pass Plans-to-Estimate orchestrator.
//
// Runs three specialized prompts in sequence and stitches their
// outputs into a single PtoEOutput:
//
//   1. title-block:  reads page 1 / front matter -> project metadata
//   2. bid-schedule: reads the agency bid schedule -> bidItems[]
//   3. spec-extras:  reads spec text -> additional items the
//                    schedule omits (mobilization, TCP, SWPPP, etc.)
//
// Each pass receives only the text it needs, with prior-pass
// context where useful (the bid-schedule pass gets the project
// name + agency, the spec-extras pass gets a summary of what's
// already on the schedule). That lets each prompt be tighter
// than the single-pass version + reduces hallucination from the
// model trying to be helpful across the whole document.
//
// Drawings text isn't passed in for now — quantity verification
// against the drawings is a Phase 2 concern (it benefits from
// the page-image OCR + the structured-page text extractor that
// haven't shipped yet).
//
// Each pass runs against the same any-cast SDK pattern as
// plans-to-estimate.ts since @anthropic-ai/sdk@0.20.9 ships
// incomplete tool-use types.

import { anthropic, DEFAULT_MODEL } from '../lib/anthropic';
import {
  PROMPT_VERSION as TITLE_BLOCK_VERSION,
  SYSTEM_PROMPT as TITLE_BLOCK_SYSTEM,
  SUBMIT_TOOL_INPUT_SCHEMA as TITLE_BLOCK_TOOL_SCHEMA,
  SUBMIT_TOOL_NAME as TITLE_BLOCK_TOOL_NAME,
  buildUserMessage as buildTitleBlockUserMessage,
} from '../lib/prompts/plans-to-estimate-title-block-v1';
import {
  PROMPT_VERSION as BID_SCHEDULE_VERSION,
  SYSTEM_PROMPT as BID_SCHEDULE_SYSTEM,
  SUBMIT_TOOL_INPUT_SCHEMA as BID_SCHEDULE_TOOL_SCHEMA,
  SUBMIT_TOOL_NAME as BID_SCHEDULE_TOOL_NAME,
  buildUserMessage as buildBidScheduleUserMessage,
} from '../lib/prompts/plans-to-estimate-bid-schedule-v1';
import {
  PROMPT_VERSION as SPEC_EXTRAS_VERSION,
  SYSTEM_PROMPT as SPEC_EXTRAS_SYSTEM,
  SUBMIT_TOOL_INPUT_SCHEMA as SPEC_EXTRAS_TOOL_SCHEMA,
  SUBMIT_TOOL_NAME as SPEC_EXTRAS_TOOL_NAME,
  buildUserMessage as buildSpecExtrasUserMessage,
} from '../lib/prompts/plans-to-estimate-spec-extras-v1';
import {
  PtoEOutputSchema,
  type PtoEBidItem,
  type PtoEOutput,
  type PtoEProjectType,
} from '@yge/shared';

export interface MultiPassInput {
  /** Title block / front-matter text. */
  titleBlockText: string;
  /** Bid schedule text — the line-item table the agency printed. */
  bidScheduleText: string;
  /** Spec text — used by the spec-extras pass. Optional; when
   *  omitted, the spec-extras pass is skipped. */
  specText?: string;
  /** Free-form estimator notes carried into every pass for context. */
  sessionNotes?: string;
  client?: Pick<typeof anthropic, 'messages'>;
  model?: string;
}

export interface PerPassUsage {
  inputTokens: number;
  outputTokens: number;
  promptVersion: string;
}

export interface MultiPassResult {
  output: PtoEOutput;
  modelUsed: string;
  passes: {
    titleBlock: PerPassUsage;
    bidSchedule: PerPassUsage;
    specExtras?: PerPassUsage;
  };
}

export class MultiPassError extends Error {
  public override readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'MultiPassError';
    this.cause = cause;
  }
}

interface ToolCallResult<T> {
  output: T;
  inputTokens: number;
  outputTokens: number;
}

async function callToolPass<T>(args: {
  client: Pick<typeof anthropic, 'messages'>;
  model: string;
  system: string;
  toolName: string;
  toolSchema: unknown;
  userMessage: string;
  passLabel: string;
}): Promise<ToolCallResult<T>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: any = {
    model: args.model,
    max_tokens: 4096,
    system: args.system,
    tools: [
      {
        name: args.toolName,
        description: `Submit the ${args.passLabel} structured output. Call exactly once.`,
        input_schema: args.toolSchema,
      },
    ],
    tool_choice: { type: 'tool', name: args.toolName },
    messages: [{ role: 'user', content: args.userMessage }],
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response: any = await args.client.messages.create(params);
  const toolUse = response.content.find(
    (b: { type: string }) => b.type === 'tool_use',
  ) as { type: 'tool_use'; input: T } | undefined;
  if (!toolUse) {
    throw new MultiPassError(
      `${args.passLabel}: model did not call ${args.toolName}. Stop reason: ${response.stop_reason}`,
    );
  }
  return {
    output: toolUse.input,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

interface TitleBlockOutput {
  projectName: string;
  projectType: PtoEProjectType;
  location?: string;
  ownerAgency?: string;
  bidDueDate?: string;
  prebidMeeting?: string;
  contractNumber?: string;
}

interface BidScheduleOutput {
  bidItems: PtoEBidItem[];
}

interface SpecExtrasOutput {
  extras: Array<{
    description: string;
    unit: string;
    quantity: number;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    specReference: string;
    notes?: string;
  }>;
  assumptions: string[];
  questionsForEstimator?: string[];
}

/**
 * Run the orchestrator. Each pass throws MultiPassError on
 * Anthropic failure / schema mismatch; the orchestrator does NOT
 * retry — it surfaces the partial result on the throw so the
 * caller can decide whether to retry the whole thing or rerun
 * just the failing pass with adjusted inputs.
 */
export async function runMultiPass(input: MultiPassInput): Promise<MultiPassResult> {
  if (!input.titleBlockText?.trim()) throw new MultiPassError('titleBlockText is empty');
  if (!input.bidScheduleText?.trim()) throw new MultiPassError('bidScheduleText is empty');

  const client = input.client ?? anthropic;
  const model = input.model ?? DEFAULT_MODEL;

  // ---- Pass 1: title block ----
  const titleBlock = await callToolPass<TitleBlockOutput>({
    client, model,
    system: TITLE_BLOCK_SYSTEM,
    toolName: TITLE_BLOCK_TOOL_NAME,
    toolSchema: TITLE_BLOCK_TOOL_SCHEMA,
    userMessage: buildTitleBlockUserMessage(input.titleBlockText),
    passLabel: 'title-block',
  });

  // ---- Pass 2: bid schedule ----
  const schedule = await callToolPass<BidScheduleOutput>({
    client, model,
    system: BID_SCHEDULE_SYSTEM,
    toolName: BID_SCHEDULE_TOOL_NAME,
    toolSchema: BID_SCHEDULE_TOOL_SCHEMA,
    userMessage: buildBidScheduleUserMessage({
      bidScheduleText: input.bidScheduleText,
      projectName: titleBlock.output.projectName,
      ownerAgency: titleBlock.output.ownerAgency,
    }),
    passLabel: 'bid-schedule',
  });

  // ---- Pass 3: spec extras (optional) ----
  let specExtras: ToolCallResult<SpecExtrasOutput> | null = null;
  if (input.specText && input.specText.trim().length > 0) {
    const scheduleSummary = schedule.output.bidItems
      .map((b) => `${b.itemNumber}. ${b.description} (${b.quantity} ${b.unit})`)
      .join('\n');
    specExtras = await callToolPass<SpecExtrasOutput>({
      client, model,
      system: SPEC_EXTRAS_SYSTEM,
      toolName: SPEC_EXTRAS_TOOL_NAME,
      toolSchema: SPEC_EXTRAS_TOOL_SCHEMA,
      userMessage: buildSpecExtrasUserMessage({
        specText: input.specText,
        scheduleSummary,
        projectType: titleBlock.output.projectType,
      }),
      passLabel: 'spec-extras',
    });
  }

  // ---- Stitch into a PtoEOutput ----
  const stitchedItems: PtoEBidItem[] = [...schedule.output.bidItems];
  if (specExtras) {
    // Append spec-extras items with auto-generated itemNumbers right
    // after the schedule. Use 'X.<n>' so the estimator can spot them.
    for (let i = 0; i < specExtras.output.extras.length; i += 1) {
      const e = specExtras.output.extras[i]!;
      stitchedItems.push({
        itemNumber: `X.${i + 1}`,
        description: e.description,
        unit: e.unit,
        quantity: e.quantity,
        confidence: e.confidence,
        notes: [e.notes, `Spec: ${e.specReference}`].filter(Boolean).join(' · '),
      });
    }
  }

  // Overall confidence: take the lowest from any item.
  let overallConfidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH';
  for (const item of stitchedItems) {
    if (item.confidence === 'LOW') overallConfidence = 'LOW';
    else if (item.confidence === 'MEDIUM' && overallConfidence === 'HIGH') {
      overallConfidence = 'MEDIUM';
    }
  }

  const stitched: PtoEOutput = PtoEOutputSchema.parse({
    projectName: titleBlock.output.projectName,
    projectType: titleBlock.output.projectType,
    location: titleBlock.output.location,
    ownerAgency: titleBlock.output.ownerAgency,
    bidDueDate: titleBlock.output.bidDueDate,
    prebidMeeting: titleBlock.output.prebidMeeting,
    bidItems: stitchedItems,
    assumptions: specExtras?.output.assumptions ?? [],
    questionsForEstimator: specExtras?.output.questionsForEstimator ?? [],
    overallConfidence,
  });

  return {
    output: stitched,
    modelUsed: model,
    passes: {
      titleBlock: {
        inputTokens: titleBlock.inputTokens,
        outputTokens: titleBlock.outputTokens,
        promptVersion: TITLE_BLOCK_VERSION,
      },
      bidSchedule: {
        inputTokens: schedule.inputTokens,
        outputTokens: schedule.outputTokens,
        promptVersion: BID_SCHEDULE_VERSION,
      },
      specExtras: specExtras
        ? {
            inputTokens: specExtras.inputTokens,
            outputTokens: specExtras.outputTokens,
            promptVersion: SPEC_EXTRAS_VERSION,
          }
        : undefined,
    },
  };
}
