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
        preview: m.bodyPreview.slice(0, 1000),
      })),
    },
    null,
    2,
  );

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
  const result = OutputSchema.safeParse(parsed);
  if (!result.success) return null;
  return { items: result.data.items, promptVersion: PROMPT_VERSION };
}
