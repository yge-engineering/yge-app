import { describe, expect, it } from 'vitest';
import {
  ca7107RetentionInterest,
  computeArPaymentRollup,
  sumPaymentsForInvoice,
  type ArPayment,
} from './ar-payment';

function pay(over: Partial<ArPayment>): ArPayment {
  return {
    id: 'arp-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    arInvoiceId: 'ar-aaaaaaaa',
    jobId: 'job-2026-01-01-test-aaaaaaaa',
    kind: 'PROGRESS',
    method: 'CHECK',
    receivedOn: '2026-04-01',
    amountCents: 100_000,
    ...over,
  };
}

describe('sumPaymentsForInvoice', () => {
  it('sums only payments matching the given invoice', () => {
    const a = pay({ id: 'arp-11111111', arInvoiceId: 'ar-aaaaaaaa', amountCents: 50_000 });
    const b = pay({ id: 'arp-22222222', arInvoiceId: 'ar-aaaaaaaa', amountCents: 30_000 });
    const c = pay({ id: 'arp-33333333', arInvoiceId: 'ar-bbbbbbbb', amountCents: 999_999 });
    expect(sumPaymentsForInvoice('ar-aaaaaaaa', [a, b, c])).toBe(80_000);
    expect(sumPaymentsForInvoice('ar-bbbbbbbb', [a, b, c])).toBe(999_999);
    expect(sumPaymentsForInvoice('ar-cccccccc', [a, b, c])).toBe(0);
  });
});

describe('computeArPaymentRollup', () => {
  it('counts retention release payments separately', () => {
    const r = computeArPaymentRollup([
      pay({ id: 'arp-11111111', amountCents: 100_000, kind: 'PROGRESS' }),
      pay({ id: 'arp-22222222', amountCents: 50_000, kind: 'RETENTION_RELEASE' }),
      pay({ id: 'arp-33333333', amountCents: 25_000, kind: 'RETENTION_RELEASE' }),
    ]);
    expect(r.total).toBe(3);
    expect(r.totalCents).toBe(175_000);
    expect(r.retentionReleaseCount).toBe(2);
    expect(r.retentionReleaseCents).toBe(75_000);
  });
});

describe('ca7107RetentionInterest', () => {
  it('returns zero days late when retention is released within 60 days', () => {
    const r = ca7107RetentionInterest({
      completedOn: '2026-01-01',
      releasedOn: '2026-02-15', // 45 days later
      retentionHeldCents: 50_000_00, // $50,000
    });
    expect(r.dueOn).toBe('2026-03-02'); // 60 days after completion
    expect(r.daysLate).toBe(0);
    expect(r.interestCents).toBe(0);
  });

  it('computes 2% per month interest when retention is released late', () => {
    // Completion 2026-01-01, due 2026-03-02 (60 days), released 2026-04-02
    // = 31 days late on $50,000.
    // Daily rate = 0.02 / 30 = 0.000666...
    // Interest = 50,000 * 0.000666... * 31 = ~$1,033.33
    const r = ca7107RetentionInterest({
      completedOn: '2026-01-01',
      releasedOn: '2026-04-02',
      retentionHeldCents: 50_000_00,
    });
    expect(r.dueOn).toBe('2026-03-02');
    expect(r.daysLate).toBe(31);
    // 50_000_00 * (0.02/30) * 31 = 103333.33... cents
    expect(r.interestCents).toBe(103_333);
  });

  it('uses now as the end date when retention is still outstanding', () => {
    const r = ca7107RetentionInterest({
      completedOn: '2026-01-01',
      retentionHeldCents: 10_000_00,
      now: new Date('2026-04-01T00:00:00Z'),
    });
    expect(r.daysLate).toBeGreaterThan(0);
    expect(r.interestCents).toBeGreaterThan(0);
  });
});
