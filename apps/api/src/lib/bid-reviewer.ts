// Wrapper around the bid-review prompt.

import { z } from 'zod';
import { anthropic, DEFAULT_MODEL } from './anthropic';
import {
  PROMPT_VERSION,
  SYSTEM_PROMPT,
} from './prompts/bid-review-v1';
import type { PricedEstimate } from '@yge/shared';

const SeveritySchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);
const CategorySchema = z.enum([
  'PRICING',
  'QUANTITY',
  'MARKUP',
  'ADDENDA',
  'BID_SECURITY',
  'SUB_LIST',
  'COMPLIANCE',
  'OTHER',
]);

const FlagSchema = z.object({
  severity: SeveritySchema,
  category: CategorySchema,
  itemNumber: z.string().max(40).nullable(),
  message: z.string().max(400),
});
const SuggestionSchema = z.object({
  category: CategorySchema,
  itemNumber: z.string().max(40).nullable(),
  message: z.string().max(400),
});

const ResultSchema = z.object({
  readiness: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  summary: z.string().max(400),
  flags: z.array(FlagSchema).default([]),
  suggestions: z.array(SuggestionSchema).default([]),
});

export type BidReviewFlag = z.infer<typeof FlagSchema>;
export type BidReviewSuggestion = z.infer<typeof SuggestionSchema>;
export type BidReviewResult = z.infer<typeof ResultSchema> & {
  promptVersion: string;
};

/** Trim the estimate down to the fields the prompt cares about. The
 *  goal is keeping the AI input tight + reproducible — fields like
 *  createdAt aren't useful and just bloat tokens. */
function summarizeForReview(est: PricedEstimate) {
  return {
    id: est.id,
    projectName: est.projectName,
    projectType: est.projectType,
    ownerAgency: est.ownerAgency ?? null,
    bidItems: est.bidItems.map((it) => ({
      itemNumber: it.itemNumber,
      description: it.description,
      unit: it.unit,
      quantity: it.quantity,
      unitPriceCents: it.unitPriceCents,
      schedule: it.schedule ?? null,
      isAlternate: Boolean(it.isAlternate),
      reviewState: it.reviewState ?? null,
      markupPct: it.markupPct ?? null,
    })),
    oppPercent: est.oppPercent,
    markup: est.markup ?? null,
    subBids: (est.subBids ?? []).map((s) => ({
      contractorName: s.contractorName,
      portionOfWork: s.portionOfWork,
      bidAmountCents: s.bidAmountCents,
      cslbLicense: s.cslbLicense ?? null,
    })),
    addenda: (est.addenda ?? []).map((a) => ({
      number: a.number,
      acknowledged: a.acknowledged,
      dateIssued: a.dateIssued ?? null,
    })),
    bidSecurity: est.bidSecurity ?? null,
    notes: est.notes ?? null,
  };
}

export async function reviewBid(
  estimate: PricedEstimate,
): Promise<BidReviewResult | null> {
  const userMessage = JSON.stringify(summarizeForReview(estimate), null, 2);

  const res = await anthropic.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const textBlock = res.content.find(
    (b): b is { type: 'text'; text: string } => b.type === 'text',
  );
  if (!textBlock) return null;

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
  const result = ResultSchema.safeParse(parsed);
  if (!result.success) return null;
  return { ...result.data, promptVersion: PROMPT_VERSION };
}
