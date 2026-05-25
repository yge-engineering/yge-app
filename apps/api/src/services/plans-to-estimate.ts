// Plans-to-Estimate service — wraps the Anthropic call and validates output.
// The endpoint is responsible for fetching files / extracting text; this layer
// only knows how to ask Claude for a draft and parse the result.

// SDK 0.20.9's exported types are too thin for tool use. Drop the
// type-only namespace import and just structurally type SUBMIT_TOOL —
// the runtime call still goes through the typed `anthropic` client.
import { anthropic, DEFAULT_MODEL } from '../lib/anthropic';
import { SYSTEM_PROMPT, buildUserMessage, PROMPT_VERSION } from '../lib/prompts/plans-to-estimate-v1';
import { PtoEOutputSchema, sumPtoEBidTotalCents, type PtoEOutput } from '@yge/shared';
import { loadYgeRateBookForPrompt } from '../lib/yge-rate-book';

export interface RunPlansToEstimateInput {
  /** Plain-text source of the project — paste of an RFP, OCR output of a
   *  plan set, etc. Optional when `pdfBase64` is supplied (the AI can
   *  read the document directly), required otherwise. */
  documentText?: string;
  sessionNotes?: string;
  /** Base64-encoded PDF bytes. When supplied, the AI receives the full
   *  PDF as a vision-enabled `type:'document'` block so it can SEE the
   *  drawings — measure lot dimensions against the scale bar, count
   *  conduit linear feet from the utility plan, derive cut/fill from
   *  cross-sections, etc. Without this the AI can only work from
   *  whatever text was extracted earlier in the pipeline, which loses
   *  every drawing-derived quantity. */
  pdfBase64?: string;
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
      // v1.5.0: structured location so the server can drive trucking-
      // from-quarry math. AI must extract city + county whenever the
      // title block or vicinity map names them. lat/lng are optional —
      // most plan sets don't print decimal degrees.
      locationCity: { type: 'string' },
      locationCounty: { type: 'string' },
      locationLat: { type: 'number', minimum: -90, maximum: 90 },
      locationLng: { type: 'number', minimum: -180, maximum: 180 },
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
      // v1.3.0: each assumption must start with [HIGH] / [MED] / [LOW].
      assumptions: { type: 'array', items: { type: 'string' } },
      // v1.3.0: items the DOCUMENT explicitly says owner furnishes.
      // The AI is forbidden from putting anything here unless the
      // plans / spec literally say so — this is the hard line
      // against hallucinated owner-furnishes scope reductions.
      ownerFurnishedItems: { type: 'array', items: { type: 'string' } },
      questionsForEstimator: { type: 'array', items: { type: 'string' } },
      overallConfidence: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
      // Roll-up across bidItems. The service backfills this when the
      // model forgets, so the UI always has a total.
      estimatedBidTotalCents: { type: 'integer', minimum: 0 },
      // v1.3.0: AI's calendar-month duration estimate.
      // v1.4.0: must be DERIVED from production rates × quantities ×
      // site-condition multiplier, with the derivation in scheduleNote.
      estimatedDurationCalendarMonths: { type: 'integer', minimum: 1, maximum: 120 },
      scheduleNote: { type: 'string' },
      // v1.4.0: AI's read on whether the site is energized / occupied.
      // Drives the production-rate multiplier on the schedule.
      siteCondition: {
        type: 'string',
        enum: ['LIVE', 'GREENFIELD', 'PARTIAL_LIVE', 'UNKNOWN'],
      },
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
  const hasText = !!(input.documentText && input.documentText.trim().length > 0);
  const hasPdf = !!(input.pdfBase64 && input.pdfBase64.length > 0);
  if (!hasText && !hasPdf) {
    throw new PlansToEstimateError(
      'Either documentText or pdfBase64 must be provided.',
    );
  }

  const client = input.client ?? anthropic;
  const model = input.model ?? DEFAULT_MODEL;

  // Load the company's master rate book — when populated, the AI gets
  // YGE's actual labor / equipment / material numbers prepended to its
  // user message so unit prices anchor to YGE actuals instead of the
  // generic NorCal averages baked into the system prompt. No-op when
  // the rate tables are empty.
  const rateBook = await loadYgeRateBookForPrompt();

  // When we have the original PDF, ALWAYS prefer the vision path. The
  // AI needs to see the drawings to do real takeoff math — text alone
  // strips the scale bar, the plan-view shapes, the cross-sections,
  // and the utility runs. The user pastes-text path stays available
  // for RFPs that arrived as Word docs / emails.
  const baseMessage = hasPdf
    ? buildUserMessage(undefined, input.sessionNotes, { hasPdf: true })
    : buildUserMessage(input.documentText, input.sessionNotes);
  const userMessage =
    rateBook.text.length > 0 ? `${rateBook.text}\n\n${baseMessage}` : baseMessage;

  const content: unknown[] = [];
  if (hasPdf) {
    content.push({
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: input.pdfBase64,
      },
    });
  }
  content.push({ type: 'text', text: userMessage });

  // NOTE: @anthropic-ai/sdk@0.20.9 (pinned via lockfile) ships incomplete
  // tool-use types — `tools`/`tool_choice` aren't on MessageCreateParamsBase,
  // ToolUseBlock isn't discriminated from TextBlock, and the response union
  // includes Stream<MessageStreamEvent> with no `usage`/`content`/`stop_reason`.
  // Everything works at runtime; we cast both sides through any so typecheck
  // passes. When we bump the SDK these casts can come out.
  const createParams: any = {
    model,
    // Vision-takeoff output is heavy on prose: per-line takeoff math
    // in notes, scheduleNote derivation walkthrough, ownerFurnished-
    // Items quotes, per-assumption risk tags. v1.5.0 was hitting the
    // 8K cap on real plan sets and returning partial submit_draft_
    // estimate input (bidItems undefined). 24K gives plenty of
    // headroom — Sonnet 4.5 supports 64K output total.
    max_tokens: hasPdf ? 24_576 : 4096,
    system: SYSTEM_PROMPT,
    tools: [SUBMIT_TOOL],
    tool_choice: { type: 'tool', name: SUBMIT_TOOL.name },
    messages: [{ role: 'user', content }],
  };
  const response: any = await client.messages.create(createParams);

  const stopReason: string | undefined = response.stop_reason;
  const toolUse = response.content.find(
    (b: { type: string }) => b.type === 'tool_use',
  ) as { type: 'tool_use'; input: unknown } | undefined;
  if (!toolUse) {
    throw new PlansToEstimateError(
      `Model did not call submit_draft_estimate. Stop reason: ${stopReason ?? 'unknown'}.${
        stopReason === 'max_tokens'
          ? ' The AI ran out of output budget before producing any structured response — bump max_tokens or shrink the prompt.'
          : ''
      }`,
    );
  }

  // First parse attempt against the raw AI output.
  let parsed = PtoEOutputSchema.safeParse(toolUse.input);

  // When the only problems are over-long strings on descriptive
  // fields (notes, pageReference, etc.), truncating to the cap and
  // re-parsing is preferable to bailing — losing the whole bid for
  // a 90-character pageReference that should be 80 is the worst
  // possible UX. We only do this when EVERY issue is a max-length
  // overflow on a string; any other shape problem still bails.
  if (!parsed.success) {
    const allMaxLen = parsed.error.issues.every(
      (i) => i.code === 'too_big' && i.type === 'string',
    );
    if (allMaxLen) {
      const truncated = truncateOverlongStrings(toolUse.input, parsed.error.issues);
      const retry = PtoEOutputSchema.safeParse(truncated);
      if (retry.success) {
        parsed = retry;
      }
    }
  }

  if (!parsed.success) {
    if (stopReason === 'max_tokens') {
      throw new PlansToEstimateError(
        'AI response was cut off mid-takeoff — the plan set has more bid items than fit in one response. Try (1) running it again in case Anthropic returns a faster path, (2) splitting the plan set into the bid schedule + spec sheets and dropping them separately, or (3) using the multi-pass page which chunks the work.',
        toolUse.input,
      );
    }
    const issuesShort = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    throw new PlansToEstimateError(
      `submit_draft_estimate output failed validation. Stop reason: ${stopReason ?? 'unknown'}. First issues: ${issuesShort}.`,
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

/** Walk the over-length Zod issues and truncate the offending string
 *  in a deep-cloned copy of the AI output. Each Zod issue has a
 *  `path` (array of keys / indexes) + a `maximum` length we trimmed
 *  past. Returns the cloned object ready for a re-parse.
 *
 *  Defensive: when the path is invalid for the cloned object (rare —
 *  Zod could in theory issue against a node that no longer exists)
 *  we just skip that issue. Worst case the re-parse fails on the
 *  same issue and we surface the original error to the user. */
function truncateOverlongStrings(input: unknown, issues: readonly any[]): unknown {
  const cloned: unknown = JSON.parse(JSON.stringify(input));
  for (const issue of issues) {
    if (issue.code !== 'too_big' || issue.type !== 'string') continue;
    const max = Number(issue.maximum);
    if (!Number.isFinite(max) || max <= 0) continue;
    const parent = walkToParent(cloned, issue.path);
    if (!parent) continue;
    const key = issue.path[issue.path.length - 1];
    const value = parent[key];
    if (typeof value !== 'string') continue;
    parent[key] = value.slice(0, max - 3) + '...';
  }
  return cloned;
}

/** Drill into a nested object/array along the path, stopping at the
 *  parent of the final key. Returns null when the path doesn't
 *  resolve. */
function walkToParent(root: unknown, path: readonly (string | number)[]): any {
  if (path.length === 0) return null;
  let cur: any = root;
  for (let i = 0; i < path.length - 1; i += 1) {
    if (cur == null) return null;
    cur = cur[path[i] as string | number];
  }
  return cur ?? null;
}
