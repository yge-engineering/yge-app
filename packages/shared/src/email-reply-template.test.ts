import { describe, it, expect } from 'vitest';
import {
  EmailReplyContextSchema,
  buildEmailReply,
  type EmailReplyContext,
} from './email-reply-template';

const baseCtx: EmailReplyContext = EmailReplyContextSchema.parse({
  senderFirstName: 'Sam',
  inboundSubject: 'Plans for Sulphur Springs',
  projectName: 'Sulphur Springs Soquol Rd',
  projectNumber: 'SS-2026',
  ourSignerName: 'Ryan Young',
  ourSignerTitle: 'VP',
  ourPhone: '707-599-9921',
  ourEmail: 'ryoung@youngge.com',
});

describe('buildEmailReply — common fields', () => {
  it('prefixes the subject with Re:', () => {
    const r = buildEmailReply('GENERIC_THANKS', baseCtx);
    expect(r.subject).toBe('Re: Plans for Sulphur Springs');
  });

  it('uses first-name greeting when known', () => {
    const r = buildEmailReply('GENERIC_THANKS', baseCtx);
    expect(r.body).toMatch(/^Hi Sam,/);
  });

  it('falls back to "Hi there," when first name absent', () => {
    const ctx = EmailReplyContextSchema.parse({
      ...baseCtx,
      senderFirstName: undefined,
    });
    const r = buildEmailReply('GENERIC_THANKS', ctx);
    expect(r.body).toMatch(/^Hi there,/);
  });

  it('ends every body with the YGE signature block', () => {
    const r = buildEmailReply('ACK_BID_INVITATION', baseCtx);
    expect(r.body).toContain('Ryan Young');
    expect(r.body).toContain('VP, Young General Engineering, Inc.');
    expect(r.body).toContain('707-599-9921 · ryoung@youngge.com');
  });

  it('includes the project line when project context provided', () => {
    const r = buildEmailReply('ACK_BID_INVITATION', baseCtx);
    expect(r.body).toContain('Project: Sulphur Springs Soquol Rd (#SS-2026)');
  });

  it('omits the project line when context lacks one', () => {
    const ctx = EmailReplyContextSchema.parse({
      ...baseCtx,
      projectName: undefined,
      projectNumber: undefined,
    });
    const r = buildEmailReply('GENERIC_THANKS', ctx);
    expect(r.body).not.toContain('Project:');
  });
});

describe('buildEmailReply — ACK_BID_INVITATION', () => {
  it('says we are bidding + references the due date when given', () => {
    const ctx = EmailReplyContextSchema.parse({
      ...baseCtx,
      bidDueDate: '2026-06-12',
    });
    const r = buildEmailReply('ACK_BID_INVITATION', ctx);
    expect(r.body).toContain('will be bidding');
    expect(r.body).toContain('2026-06-12');
  });

  it('falls back to "before the bid due date" when no date given', () => {
    const r = buildEmailReply('ACK_BID_INVITATION', baseCtx);
    expect(r.body).toContain('before the bid due date');
  });
});

describe('buildEmailReply — NO_BID_DECLINE', () => {
  it('declines politely and asks to be kept in mind', () => {
    const r = buildEmailReply('NO_BID_DECLINE', baseCtx);
    expect(r.body).toContain("we're going to pass");
    expect(r.body).toContain('keep us in mind');
  });
});

describe('buildEmailReply — RFI_ACK', () => {
  it('includes RFI number when provided', () => {
    const ctx = EmailReplyContextSchema.parse({ ...baseCtx, rfiNumber: '14' });
    const r = buildEmailReply('RFI_ACK', ctx);
    expect(r.body).toContain('RFI #14');
  });

  it('omits the RFI number when missing', () => {
    const r = buildEmailReply('RFI_ACK', baseCtx);
    expect(r.body).not.toContain('RFI #');
  });
});

describe('buildEmailReply — SEND_COI_LINK', () => {
  it('includes the COI link when provided', () => {
    const ctx = EmailReplyContextSchema.parse({
      ...baseCtx,
      coiUrl: 'https://example.com/coi.pdf',
    });
    const r = buildEmailReply('SEND_COI_LINK', ctx);
    expect(r.body).toContain('https://example.com/coi.pdf');
  });
});

describe('buildEmailReply — money-aware templates', () => {
  it('REQUEST_LIEN_WAIVER includes the formatted amount', () => {
    const ctx = EmailReplyContextSchema.parse({
      ...baseCtx,
      amountCents: 42_137_55,
    });
    const r = buildEmailReply('REQUEST_LIEN_WAIVER', ctx);
    expect(r.body).toContain('$42,137.55');
  });

  it('PAYMENT_RECEIVED_ACK includes the formatted amount', () => {
    const ctx = EmailReplyContextSchema.parse({
      ...baseCtx,
      amountCents: 100_000_00,
    });
    const r = buildEmailReply('PAYMENT_RECEIVED_ACK', ctx);
    expect(r.body).toContain('$100,000.00');
  });
});

describe('buildEmailReply — REQUEST_W9 + SUBMITTAL_ACK + GENERIC_THANKS', () => {
  it('REQUEST_W9 explains why we need it', () => {
    const r = buildEmailReply('REQUEST_W9', baseCtx);
    expect(r.body).toContain('W-9');
    expect(r.body).toContain('issue payment');
  });

  it('SUBMITTAL_ACK sets the 5-day review expectation', () => {
    const r = buildEmailReply('SUBMITTAL_ACK', baseCtx);
    expect(r.body).toContain('five business days');
  });

  it('GENERIC_THANKS is short', () => {
    const r = buildEmailReply('GENERIC_THANKS', baseCtx);
    // Greeting + acknowledgment + signature → ≤ 7 lines.
    expect(r.body.split('\n').length).toBeLessThanOrEqual(7);
  });
});
