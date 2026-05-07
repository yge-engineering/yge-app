// Wrapper around the bid-tab extract prompt.

import { z } from 'zod';
import { anthropic, DEFAULT_MODEL } from './anthropic';
import {
  PROMPT_VERSION,
  SYSTEM_PROMPT,
} from './prompts/bid-tab-extract-v1';

const BidderSchema = z.object({
  rank: z.number().int().positive().nullish(),
  name: z.string().min(1).max(200),
  totalCents: z.number().int().nonnegative(),
  cslbLicense: z.string().max(40).nullish(),
});

const ResultSchema = z.object({
  agencyName: z.string().max(200).nullish(),
  projectName: z.string().max(200).nullish(),
  projectNumber: z.string().max(80).nullish(),
  county: z.string().max(80).nullish(),
  bidOpenedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  engineersEstimateCents: z.number().int().nonnegative().nullish(),
  bidders: z.array(BidderSchema).default([]),
});

const ErrorSchema = z.object({ error: z.string() });

export interface BidTabExtractResult {
  promptVersion: string;
  agencyName: string | null;
  projectName: string | null;
  projectNumber: string | null;
  county: string | null;
  bidOpenedAt: string | null;
  engineersEstimateCents: number | null;
  bidders: Array<{
    rank?: number | null;
    name: string;
    totalCents: number;
    cslbLicense?: string | null;
  }>;
}

export async function extractBidTab(
  pdfBuffer: Buffer,
): Promise<BidTabExtractResult | { error: string }> {
  const base64 = pdfBuffer.toString('base64');
  const res = await anthropic.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 6000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64,
            },
          },
          {
            type: 'text',
            text: 'Extract the bid tab.',
          },
        ],
      },
    ],
  });

  const textBlock = res.content.find(
    (b): b is { type: 'text'; text: string } => b.type === 'text',
  );
  if (!textBlock) return { error: 'AI returned no text content' };

  let raw = textBlock.text.trim();
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '').trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: 'AI returned unparseable JSON' };
  }

  const errCheck = ErrorSchema.safeParse(parsed);
  if (errCheck.success) return { error: errCheck.data.error };

  const result = ResultSchema.safeParse(parsed);
  if (!result.success) {
    return { error: 'AI response did not match the bid-tab schema' };
  }

  return {
    promptVersion: PROMPT_VERSION,
    agencyName: result.data.agencyName ?? null,
    projectName: result.data.projectName ?? null,
    projectNumber: result.data.projectNumber ?? null,
    county: result.data.county ?? null,
    bidOpenedAt: result.data.bidOpenedAt ?? null,
    engineersEstimateCents: result.data.engineersEstimateCents ?? null,
    bidders: result.data.bidders.map((b) => ({
      rank: b.rank ?? null,
      name: b.name,
      totalCents: b.totalCents,
      cslbLicense: b.cslbLicense ?? null,
    })),
  };
}
