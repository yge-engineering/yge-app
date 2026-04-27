import { describe, expect, it } from 'vitest';
import { buildLienWaiverChase } from './lien-waiver-chase';
import type { ArPayment } from './ar-payment';
import type { LienWaiver } from './lien-waiver';

function pay(over: Partial<ArPayment>): ArPayment {
  return {
    id: 'pay-1',
    createdAt: '',
    updatedAt: '',
    arInvoiceId: 'ar-1',
    jobId: 'job-1',
    kind: 'PROGRESS',
    method: 'CHECK',
    receivedOn: '2026-04-15',
    amountCents: 50_000_00,
    ...over,
  } as ArPayment;
}

function lw(over: Partial<LienWaiver>): LienWaiver {
  return {
    id: 'lw-1',
    createdAt: '2026-04-15T00:00:00Z',
    updatedAt: '2026-04-15T00:00:00Z',
    jobId: 'job-1',
    kind: 'CONDITIONAL_PROGRESS',
    status: 'DELIVERED',
    ownerName: 'Cal Fire',
    jobName: 'Sulphur Springs',
    claimantName: 'YGE',
    paymentAmountCents: 50_000_00,
    throughDate: '2026-04-15',
    ...over,
  } as LienWaiver;
}

describe('buildLienWaiverChase', () => {
  it('flags NO_WAIVER_DRAFTED when payment has no matching waiver', () => {
    const r = buildLienWaiverChase({
      asOf: '2026-04-27',
      arPayments: [pay({ id: 'p1' })],
      lienWaivers: [],
    });
    expect(r.rows[0]?.reason).toBe('NO_WAIVER_DRAFTED');
    expect(r.rollup.noWaiver).toBe(1);
  });

  it('matches waiver via arPaymentId link', () => {
    const r = buildLienWaiverChase({
      asOf: '2026-04-27',
      arPayments: [pay({ id: 'p1' })],
      lienWaivers: [
        lw({ id: 'w1', arPaymentId: 'p1', status: 'DELIVERED' }),
        // CONDITIONAL_PROGRESS + DELIVERED → needs matching unconditional
      ],
    });
    expect(r.rows[0]?.reason).toBe('CONDITIONAL_PAID_NEEDS_UNCONDITIONAL');
  });

  it('matches waiver via arInvoiceId fallback', () => {
    const r = buildLienWaiverChase({
      asOf: '2026-04-27',
      arPayments: [pay({ id: 'p1', arInvoiceId: 'ar-99' })],
      lienWaivers: [
        lw({ id: 'w1', arInvoiceId: 'ar-99', status: 'DRAFT' }),
      ],
    });
    expect(r.rows[0]?.reason).toBe('WAIVER_DRAFT_NOT_SIGNED');
  });

  it('flags WAIVER_SIGNED_NOT_DELIVERED', () => {
    const r = buildLienWaiverChase({
      asOf: '2026-04-27',
      arPayments: [pay({ id: 'p1' })],
      lienWaivers: [lw({ id: 'w1', arPaymentId: 'p1', status: 'SIGNED' })],
    });
    expect(r.rows[0]?.reason).toBe('WAIVER_SIGNED_NOT_DELIVERED');
  });

  it('skips when conditional + delivered + matching unconditional already on file', () => {
    const r = buildLienWaiverChase({
      asOf: '2026-04-27',
      arPayments: [pay({ id: 'p1' })],
      lienWaivers: [
        lw({ id: 'w1', arPaymentId: 'p1', kind: 'CONDITIONAL_PROGRESS', status: 'DELIVERED' }),
        lw({ id: 'w2', arPaymentId: 'p1', kind: 'UNCONDITIONAL_PROGRESS', status: 'DELIVERED' }),
      ],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('VOIDED waivers do not count as on-file', () => {
    const r = buildLienWaiverChase({
      asOf: '2026-04-27',
      arPayments: [pay({ id: 'p1' })],
      lienWaivers: [lw({ id: 'w1', arPaymentId: 'p1', status: 'VOIDED' })],
    });
    expect(r.rows[0]?.reason).toBe('NO_WAIVER_DRAFTED');
  });

  it('sorts oldest unaddressed payment first', () => {
    const r = buildLienWaiverChase({
      asOf: '2026-04-27',
      arPayments: [
        pay({ id: 'recent', receivedOn: '2026-04-25' }),
        pay({ id: 'old', receivedOn: '2026-02-10' }),
        pay({ id: 'mid', receivedOn: '2026-03-15' }),
      ],
      lienWaivers: [],
    });
    expect(r.rows.map((x) => x.paymentId)).toEqual(['old', 'mid', 'recent']);
  });

  it('rollup tallies each reason bucket', () => {
    const r = buildLienWaiverChase({
      asOf: '2026-04-27',
      arPayments: [
        pay({ id: 'p1', arInvoiceId: 'ar-1' }),
        pay({ id: 'p2', arInvoiceId: 'ar-2' }),
        pay({ id: 'p3', arInvoiceId: 'ar-3' }),
        pay({ id: 'p4', arInvoiceId: 'ar-4' }),
      ],
      lienWaivers: [
        // p1 — none
        // p2 — DRAFT
        lw({ id: 'w2', arPaymentId: 'p2', status: 'DRAFT' }),
        // p3 — SIGNED not delivered
        lw({ id: 'w3', arPaymentId: 'p3', status: 'SIGNED' }),
        // p4 — conditional delivered, needs unconditional
        lw({ id: 'w4', arPaymentId: 'p4', kind: 'CONDITIONAL_PROGRESS', status: 'DELIVERED' }),
      ],
    });
    expect(r.rollup.noWaiver).toBe(1);
    expect(r.rollup.draft).toBe(1);
    expect(r.rollup.signedNotDelivered).toBe(1);
    expect(r.rollup.conditionalNeedsUnconditional).toBe(1);
  });
});
