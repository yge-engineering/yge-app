import { describe, it, expect } from 'vitest';
import {
  W9ChaseInputSchema,
  buildW9ChaseEmail,
  type W9ChaseInput,
} from './w9-chase-email';

const base: W9ChaseInput = W9ChaseInputSchema.parse({
  vendorName: 'Acme Hardware LLC',
  vendorContactName: 'Sam Smith',
  vendorEmail: 'ap@acmehardware.example',
  ytdPaymentsCents: 12_450_00,
  asOfDate: '2026-12-15',
  ourSignerName: 'Ryan Young',
  ourSignerTitle: 'VP',
  ourPhone: '707-599-9921',
  ourEmail: 'ryoung@youngge.com',
});

describe('buildW9ChaseEmail — first notice', () => {
  it('subject says W-9 needed', () => {
    const r = buildW9ChaseEmail(base);
    expect(r.subject).toBe('W-9 needed for Acme Hardware LLC (year-end 1099)');
  });

  it('greets by first name when contact is set', () => {
    const r = buildW9ChaseEmail(base);
    expect(r.body).toMatch(/^Hi Sam,/);
  });

  it('formats the YTD amount as US dollars', () => {
    const r = buildW9ChaseEmail(base);
    expect(r.body).toContain('$12,450.00');
  });

  it('includes the IRS W-9 link', () => {
    const r = buildW9ChaseEmail(base);
    expect(r.body).toContain('https://www.irs.gov/pub/irs-pdf/fw9.pdf');
  });

  it('does not mention backup withholding on the first notice', () => {
    const r = buildW9ChaseEmail(base);
    expect(r.body).not.toContain('BACKUP WITHHOLDING');
    expect(r.body).not.toContain('Second request');
  });

  it('signature block ends with YGE info', () => {
    const r = buildW9ChaseEmail(base);
    expect(r.body).toContain('Ryan Young');
    expect(r.body).toContain('VP, Young General Engineering, Inc.');
    expect(r.body).toContain('707-599-9921 · ryoung@youngge.com');
  });
});

describe('buildW9ChaseEmail — second notice', () => {
  it('subject says second request', () => {
    const r = buildW9ChaseEmail({ ...base, secondNotice: true });
    expect(r.subject).toContain('Second request');
  });

  it('warns about 24% backup withholding per IRC §3406', () => {
    const r = buildW9ChaseEmail({ ...base, secondNotice: true });
    expect(r.body).toContain('BACKUP WITHHOLDING');
    expect(r.body).toContain('24%');
    expect(r.body).toContain('IRC §3406');
  });
});

describe('buildW9ChaseEmail — fallbacks', () => {
  it('uses "Hi there," when contact name missing', () => {
    const r = buildW9ChaseEmail({ ...base, vendorContactName: undefined });
    expect(r.body).toMatch(/^Hi there,/);
  });

  it('includes upload link when supplied', () => {
    const r = buildW9ChaseEmail({ ...base, uploadUrl: 'https://app.youngge.com/upload/w9/x' });
    expect(r.body).toContain('https://app.youngge.com/upload/w9/x');
  });

  it('omits upload-line when no URL', () => {
    const r = buildW9ChaseEmail(base);
    expect(r.body).not.toContain('upload it here');
  });
});
