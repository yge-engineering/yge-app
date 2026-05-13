// Wrapper around the email-triage prompt.

import { z } from 'zod';
import { anthropic, DEFAULT_MODEL } from './anthropic';
import {
  PROMPT_VERSION,
  SYSTEM_PROMPT,
} from './prompts/email-triage-v1';

const CategorySchema = z.enum([
  'BID_INVITATION',
  'RFI',
  'LIEN_WAIVER',
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

const ItemSchema = z.object({
  messageId: z.string().min(1).max(200),
  category: CategorySchema,
  confidence: ConfidenceSchema,
  nextAction: z.string().max(200),
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
  return { items: result.data.items, promptVersion: PROMPT_VERSION };
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
  return { items: result.data.items, rawHead, promptVersion: PROMPT_VERSION };
}
