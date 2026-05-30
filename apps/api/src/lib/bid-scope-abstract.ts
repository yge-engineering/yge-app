// Wrapper around the bid scope abstract prompt.
//
// Trims the priced estimate down to the fields the prompt actually
// reads (projectName, ownerAgency, projectType, top bid items by
// dollar value), calls Claude, parses the JSON response.

import { z } from 'zod';
import { anthropic, DEFAULT_MODEL } from './anthropic';
import {
  PROMPT_VERSION,
  SYSTEM_PROMPT,
} from './prompts/bid-scope-abstract-v1';
import type { PricedEstimate } from '@yge/shared';

const ResultSchema = z.object({
  abstract: z.string().min(1).max(800),
});

export type BidScopeAbstractResult = z.infer<typeof ResultSchema> & {
  promptVersion: string;
};

/** Pick the top N bid items by line dollar total (qty × unitPrice).
 *  Empty / un-priced lines fall to the bottom. */
function topItemsByDollars(est: PricedEstimate, n: number) {
  return [...est.bidItems]
    .map((it) => {
      const lineCents = (it.quantity ?? 0) * (it.unitPriceCents ?? 0);
      return {
        description: it.description,
        unit: it.unit ?? '',
        quantity: it.quantity ?? 0,
        dollars: Math.round(lineCents / 100),
        _sort: lineCents,
      };
    })
    .sort((a, b) => b._sort - a._sort)
    .slice(0, n)
    .map(({ _sort: _ignored, ...rest }) => rest);
}

function summarizeForAbstract(est: PricedEstimate) {
  return {
    projectName: est.projectName,
    ownerAgency: est.ownerAgency ?? null,
    projectType: est.projectType,
    topBidItems: topItemsByDollars(est, 8),
  };
}

export async function generateBidScopeAbstract(
  estimate: PricedEstimate,
): Promise<BidScopeAbstractResult | null> {
  const userMessage = JSON.stringify(summarizeForAbstract(estimate), null, 2);

  const res = await anthropic.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 800,
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
