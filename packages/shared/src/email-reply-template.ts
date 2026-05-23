// Deterministic email-reply templates for the most common office inbox
// patterns.
//
// Per the v6.3 gap analysis (Phase 3): "AI-drafted email replies" was
// not built. The instinct is to jump straight to an Anthropic-backed
// drafter, but the right architecture is: ship a deterministic
// template layer FIRST (immediately useful, never wrong, never
// hallucinates), then layer an AI step on top for the long-tail cases
// that don't fit a template.
//
// This module is the template layer. It covers ~80% of the volume:
//   ACK_BID_INVITATION       — "Yes, we received it. We'll let you
//                              know by <date>."
//   NO_BID_DECLINE           — "Thank you, we're declining to bid
//                              this one."
//   RFI_ACK                  — "We received RFI #N; targeting reply by ..."
//   SEND_COI_LINK            — "Here's our COI."
//   REQUEST_LIEN_WAIVER      — "Please send a conditional waiver for ..."
//   REQUEST_W9               — "Need your W-9 before we can issue payment."
//   PAYMENT_RECEIVED_ACK     — "Got the payment, posted today."
//   SUBMITTAL_ACK            — "We received the submittal; reviewing."
//   GENERIC_THANKS           — "Thanks — got it."
//
// Each template is a pure function: given the input context, returns a
// `{ subject, body }`. No I/O, no clock dependency, no LLM. The output
// is hand-edit-friendly — designed for the user to skim and tweak
// before clicking send.
//
// Style notes (per CLAUDE.md "Plain English"):
//   - Greeting: "Hi <firstName>," when we have it, "Hi there," when not.
//   - Sign-off: caller-supplied name + title + phone + email.
//   - No corporate fluff, no exclamation points, no emojis.

import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const EmailReplyTemplateKindSchema = z.enum([
  'ACK_BID_INVITATION',
  'NO_BID_DECLINE',
  'RFI_ACK',
  'SEND_COI_LINK',
  'REQUEST_LIEN_WAIVER',
  'REQUEST_W9',
  'PAYMENT_RECEIVED_ACK',
  'SUBMITTAL_ACK',
  'GENERIC_THANKS',
]);
export type EmailReplyTemplateKind = z.infer<typeof EmailReplyTemplateKindSchema>;

export const EmailReplyContextSchema = z.object({
  /** First name of the recipient, when known. */
  senderFirstName: z.string().max(80).optional(),
  /** Subject of the inbound email — used for the "Re:" prefix. */
  inboundSubject: z.string().min(1).max(300),
  /** Project name + number, when relevant. */
  projectName: z.string().max(300).optional(),
  projectNumber: z.string().max(120).optional(),
  /** Calendar-day deadline references. */
  bidDueDate: z.string().regex(ISO_DATE).optional(),
  rfiNumber: z.string().max(40).optional(),
  /** $ context for payment / waiver replies. */
  amountCents: z.number().int().optional(),
  /** Custom URL for COI / waiver / submittal links. */
  coiUrl: z.string().max(800).optional(),
  /** Our signer info — always required. */
  ourSignerName: z.string().min(1).max(120),
  ourSignerTitle: z.string().min(1).max(120),
  ourPhone: z.string().min(1).max(40),
  ourEmail: z.string().min(1).max(120),
});
export type EmailReplyContext = z.infer<typeof EmailReplyContextSchema>;

export interface EmailReplyDraft {
  subject: string;
  body: string;
}

/** Build a draft reply for the given template kind + context. Pure. */
export function buildEmailReply(
  kind: EmailReplyTemplateKind,
  ctx: EmailReplyContext,
): EmailReplyDraft {
  const greeting = ctx.senderFirstName ? `Hi ${ctx.senderFirstName},` : `Hi there,`;
  const subject = `Re: ${ctx.inboundSubject}`;
  const projectLine = ctx.projectName
    ? `Project: ${ctx.projectName}${ctx.projectNumber ? ` (#${ctx.projectNumber})` : ''}\n\n`
    : '';
  const sig = signature(ctx);

  switch (kind) {
    case 'ACK_BID_INVITATION': {
      const dueLine = ctx.bidDueDate
        ? `We'll have our number to you by ${ctx.bidDueDate}.`
        : `We'll have our number to you before the bid due date.`;
      return {
        subject,
        body: `${greeting}\n\n${projectLine}Thanks for the invitation. We received the plans and specs and will be bidding. ${dueLine}\n\n${sig}`,
      };
    }

    case 'NO_BID_DECLINE': {
      return {
        subject,
        body: `${greeting}\n\n${projectLine}Thanks for thinking of us. After review, we're going to pass on this one. Please keep us in mind for the next round.\n\n${sig}`,
      };
    }

    case 'RFI_ACK': {
      const ref = ctx.rfiNumber ? ` (RFI #${ctx.rfiNumber})` : '';
      return {
        subject,
        body: `${greeting}\n\n${projectLine}Got your RFI${ref}. We'll have a response back to you within two business days.\n\n${sig}`,
      };
    }

    case 'SEND_COI_LINK': {
      const link = ctx.coiUrl ? `\n\nLink: ${ctx.coiUrl}` : '';
      return {
        subject,
        body: `${greeting}\n\n${projectLine}Attached is our current Certificate of Insurance. Let me know if anything needs to be reissued for additional insureds or specific endorsements.${link}\n\n${sig}`,
      };
    }

    case 'REQUEST_LIEN_WAIVER': {
      const amt = formatMoneyLine(ctx.amountCents);
      return {
        subject,
        body: `${greeting}\n\n${projectLine}Before we cut the next progress payment${amt ? ` (${amt})` : ''}, please send a conditional lien waiver for the current period. The unconditional follows once the check clears.\n\n${sig}`,
      };
    }

    case 'REQUEST_W9': {
      return {
        subject,
        body: `${greeting}\n\n${projectLine}Before we can issue payment, we need a current W-9 on file. Could you send one over at your convenience?\n\n${sig}`,
      };
    }

    case 'PAYMENT_RECEIVED_ACK': {
      const amt = formatMoneyLine(ctx.amountCents);
      return {
        subject,
        body: `${greeting}\n\n${projectLine}Confirming receipt of payment${amt ? ` (${amt})` : ''}. Posted to your account today.\n\n${sig}`,
      };
    }

    case 'SUBMITTAL_ACK': {
      return {
        subject,
        body: `${greeting}\n\n${projectLine}Got your submittal. We'll review and send it through to the engineer for approval. Expect feedback within five business days.\n\n${sig}`,
      };
    }

    case 'GENERIC_THANKS': {
      return {
        subject,
        body: `${greeting}\n\nThanks — got it.\n\n${sig}`,
      };
    }
  }
}

function signature(ctx: EmailReplyContext): string {
  return `${ctx.ourSignerName}\n${ctx.ourSignerTitle}, Young General Engineering, Inc.\n${ctx.ourPhone} · ${ctx.ourEmail}`;
}

function formatMoneyLine(cents: number | undefined): string {
  if (cents === undefined) return '';
  const dollars = (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `$${dollars}`;
}
