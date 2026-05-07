// Calls the bank-rec match prompt (v1) against the configured Claude
// model. Returns parsed, validated suggestions or `null` if Claude's
// reply couldn't be parsed.
//
// The route layer composes the candidate list (open AR + AP + expense
// + journal-entry rows for the same bank account) and passes it here
// alongside the parsed bank-statement transactions.

import { z } from 'zod';
import { anthropic, DEFAULT_MODEL } from './anthropic';
import {
  PROMPT_VERSION,
  SYSTEM_PROMPT,
  type BankRecMatchInputCandidate,
  type BankRecMatchInputTransaction,
  type BankRecMatchOutput,
  type BankRecMatchOutputEntry,
} from './prompts/bank-rec-match-v1';

const CandidateKindSchema = z.enum([
  'ar_payment',
  'ap_payment',
  'expense',
  'journal_entry',
]);

const ConfidenceSchema = z.enum(['HIGH', 'MEDIUM', 'LOW', 'NONE']);

const MatchEntrySchema = z.object({
  transactionIdx: z.number().int().nonnegative(),
  candidateId: z.string().nullable(),
  candidateKind: CandidateKindSchema.nullable(),
  confidence: ConfidenceSchema,
  reasoning: z.string().max(280),
});

const MatchOutputSchema = z.object({
  matches: z.array(MatchEntrySchema),
});

export interface SuggestMatchesArgs {
  transactions: BankRecMatchInputTransaction[];
  candidates: BankRecMatchInputCandidate[];
  /** Override the default model for testing or A/B. */
  model?: string;
}

export async function suggestBankRecMatches(
  args: SuggestMatchesArgs,
): Promise<BankRecMatchOutput | null> {
  const userMessage = JSON.stringify(
    { transactions: args.transactions, candidates: args.candidates },
    null,
    2,
  );

  const res = await anthropic.messages.create({
    model: args.model ?? DEFAULT_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = res.content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  // Extract the first JSON object from the reply (Claude sometimes wraps
  // in ```json fences or surrounding prose).
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
  const validated = MatchOutputSchema.safeParse(parsed);
  if (!validated.success) return null;

  // Drop entries whose transactionIdx is out of bounds — Claude
  // occasionally hallucinates indices.
  const matches: BankRecMatchOutputEntry[] = validated.data.matches.filter(
    (m) => m.transactionIdx < args.transactions.length,
  );

  return {
    matches,
    promptVersion: PROMPT_VERSION,
  };
}
