// Wrapper around the daily-report narrative prompt.

import { z } from 'zod';
import { anthropic, DEFAULT_MODEL } from './anthropic';
import {
  PROMPT_VERSION,
  SYSTEM_PROMPT,
} from './prompts/daily-report-narrative-v1';

const NarrativeSchema = z.object({
  narrative: z.string().min(1).max(4_000),
});

export interface ExpandNarrativeArgs {
  bullets: string[];
  jobName?: string;
  date?: string;
  model?: string;
}

export async function expandDailyReportNarrative(
  args: ExpandNarrativeArgs,
): Promise<{ narrative: string; promptVersion: string } | null> {
  const userMessage = JSON.stringify(
    {
      bullets: args.bullets,
      jobName: args.jobName ?? null,
      date: args.date ?? null,
    },
    null,
    2,
  );

  const res = await anthropic.messages.create({
    model: args.model ?? DEFAULT_MODEL,
    max_tokens: 800,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  // Find the first text block in the response.
  const textBlock = res.content.find(
    (b): b is { type: 'text'; text: string } => b.type === 'text',
  );
  if (!textBlock) return null;

  // Strip ``` fences if Claude wraps the JSON.
  let raw = textBlock.text.trim();
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '').trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = NarrativeSchema.safeParse(parsed);
  if (!result.success) return null;
  return { narrative: result.data.narrative, promptVersion: PROMPT_VERSION };
}
