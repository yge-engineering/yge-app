// Wrapper around the email-triage prompt.

import { z } from 'zod';
import { anthropic, DEFAULT_MODEL } from './anthropic';
import {
  PROMPT_VERSION,
  SYSTEM_PROMPT,
} from './prompts/email-triage-v1';
import { detectBidPostponement } from '@yge/shared';

const CategorySchema = z.enum([
  'BID_INVITATION',
  'RFI',
  'LIEN_WAIVER',
  'COI',
  'SUBMITTAL',
  'VENDOR_BILL',
  'CUSTOMER_PAYMENT',
  'AGENCY_NOTICE',
  'EMPLOYEE_HR',
  'INTERNAL',
  'SPAM',
  'OTHER',
]);
export type EmailTriageCategory = z.infer<typeof CategorySchema>;

const ConfidenceSchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);

const PostponementSchema = z.object({
  /** 0–1 heuristic score from bid-postponement-detect. */
  confidence: z.number().min(0).max(1),
  /** Parsed new bid date (yyyy-mm-dd) when one was found. */
  newDate: z.string().optional(),
  /** First matched phrase ("bid opening postponed" / "due date moved"). */
  reasonText: z.string().optional(),
});
export type EmailTriagePostponement = z.infer<typeof PostponementSchema>;

const ItemSchema = z.object({
  messageId: z.string().min(1).max(200),
  category: CategorySchema,
  confidence: ConfidenceSchema,
  nextAction: z.string().max(200),
  /** Bid-postponement heuristic result. Only present when the
   *  detector crossed its action threshold for this message — gives
   *  the UI a "Bid date changed — review" chip and the new date when
   *  parsed. Independent of category so a mislabeled-as-INTERNAL
   *  email about a moved bid date still surfaces. */
  bidPostponement: PostponementSchema.optional(),
});

const OutputSchema = z.object({
  items: z.array(ItemSchema),
});

export type EmailTriageItem = z.infer<typeof ItemSchema>;

export interface EmailTriageMessage {
  id: string;
  subject: string;
  fromAddress: string;
  fromName?: string;
  bodyPreview: string;
  receivedAtIso: string;
}

export async function triageEmails(
  messages: EmailTriageMessage[],
): Promise<{ items: EmailTriageItem[]; promptVersion: string } | null> {
  if (messages.length === 0) {
    return { items: [], promptVersion: PROMPT_VERSION };
  }

  const userMessage = JSON.stringify(
    {
      messages: messages.map((m) => ({
        messageId: m.id,
        subject: m.subject,
        from: m.fromName ? `${m.fromName} <${m.fromAddress}>` : m.fromAddress,
        receivedAt: m.receivedAtIso,
        preview: m.bodyPreview.slice(0, 500),
      })),
    },
    null,
    2,
  );

  const res = await anthropic.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 8192,
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
  // If the model added prose before/after the JSON, extract the
  // first {...} substring.
  if (!raw.startsWith('{')) {
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      raw = raw.slice(firstBrace, lastBrace + 1);
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[email-triage] JSON.parse failed', {
      err: err instanceof Error ? err.message : String(err),
      rawHead: raw.slice(0, 500),
    });
    return null;
  }
  const result = OutputSchema.safeParse(parsed);
  if (!result.success) {
    // eslint-disable-next-line no-console
    console.error('[email-triage] OutputSchema validation failed', {
      issues: result.error.issues.slice(0, 5),
      rawHead: raw.slice(0, 500),
    });
    return null;
  }
  const items = mergeBidPostponements(result.data.items, messages);
  return { items, promptVersion: PROMPT_VERSION };
}

/** Run the bid-postponement heuristic over each inbound message and
 *  attach the result to the matching triage item. Independent of the
 *  AI's category — if the heuristic fires we want the chip visible
 *  even when the model mislabeled the email as INTERNAL or OTHER.
 *  Cheap pure-regex call; runs in the same tick. */
function mergeBidPostponements(
  items: EmailTriageItem[],
  messages: EmailTriageMessage[],
): EmailTriageItem[] {
  const byId = new Map(messages.map((m) => [m.id, m]));
  return items.map((it) => {
    const src = byId.get(it.messageId);
    if (!src) return it;
    const r = detectBidPostponement({
      subject: src.subject,
      body: src.bodyPreview,
    });
    if (!r.detected) return it;
    return {
      ...it,
      bidPostponement: {
        confidence: r.confidence,
        ...(r.newDate ? { newDate: r.newDate } : {}),
        ...(r.reasonText ? { reasonText: r.reasonText } : {}),
      },
    };
  });
}

// Diagnostic variant — returns raw AI text alongside parsed result.
// The /api/microsoft/inbox-triage route uses this so the UI can show
// the actual AI output when parsing fails.
export async function triageEmailsWithRaw(
  messages: EmailTriageMessage[],
): Promise<{
  items: EmailTriageItem[] | null;
  rawHead: string | null;
  promptVersion: string;
  error?: string;
}> {
  if (messages.length === 0) {
    return { items: [], rawHead: null, promptVersion: PROMPT_VERSION };
  }
  const userMessage = JSON.stringify(
    {
      messages: messages.map((m) => ({
        messageId: m.id,
        subject: m.subject,
        from: m.fromName ? `${m.fromName} <${m.fromAddress}>` : m.fromAddress,
        receivedAt: m.receivedAtIso,
        preview: m.bodyPreview.slice(0, 500),
      })),
    },
    null,
    2,
  );

  const res = await anthropic.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const textBlock = res.content.find(
    (b): b is { type: 'text'; text: string } => b.type === 'text',
  );
  if (!textBlock) {
    return {
      items: null,
      rawHead: null,
      promptVersion: PROMPT_VERSION,
      error: 'No text block in AI response',
    };
  }

  let raw = textBlock.text.trim();
  const rawHead = raw.slice(0, 800);
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '').trim();
  }
  if (!raw.startsWith('{')) {
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      raw = raw.slice(firstBrace, lastBrace + 1);
    }
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      items: null,
      rawHead,
      promptVersion: PROMPT_VERSION,
      error: `JSON.parse failed: ${err instanceof Error ? err.message : 'unknown'}`,
    };
  }
  const result = OutputSchema.safeParse(parsed);
  if (!result.success) {
    return {
      items: null,
      rawHead,
      promptVersion: PROMPT_VERSION,
      error: `Schema validation failed: ${result.error.issues.map((i) => i.message).join('; ')}`,
    };
  }
  const items = mergeBidPostponements(result.data.items, messages);
  return { items, rawHead, promptVersion: PROMPT_VERSION };
}
