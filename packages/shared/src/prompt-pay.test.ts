import { describe, expect, it } from 'vitest';
import {
  PROMPT_PAY_DAILY_RATE,
  buildPromptPayReport,
  caProgressPaymentInterest,
} from './prompt-pay';
import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    jobId: 'job-1',
    invoiceNumber: '1',
    customerName: 'Cal Fire',
    invoiceDate: '2026-01-01',
    source: 'MANUAL',
    lineItems: [],
    subtotalCents: 100_00,
    totalCents: 100_00,
    paidCents: 0,
    status: 'SENT',
    ...over,
  } as ArInvoice;
}

describe('caProgressPaymentInterest', () => {
  it('returns 0 daysLate when paid before due date', () => {
    const r = caProgressPaymentInterest({
      submittedOn: '2026-01-01',
      paidOn: '2026-01-15',
      unpaidCents: 10_000_00,
    });
    expect(r.dueOn).toBe('2026-01-31');
    expect(r.daysLate).toBe(0);
    expect(r.interestCents).toBe(0);
  });

  it('returns 0 daysLate when paid exactly on due date', () => {
    const r = caProgressPaymentInterest({
      submittedOn: '2026-01-01',
      paidOn: '2026-01-31',
      unpaidCents: 10_000_00,
    });
    expect(r.daysLate).toBe(0);
  });

  it('accrues 10% per annum, daily, on overdue amount', () => {
    // submitted 2026-01-01, due 2026-01-31, paid 2026-03-02 → 30 days late.
    // 10_000_00 cents × (0.10/365) × 30 ≈ 8219.18 cents → 8219 (rounded).
    const r = caProgressPaymentInterest({
      submittedOn: '2026-01-01',
      paidOn: '2026-03-02',
      unpaidCents: 10_000_00,
    });
    expect(r.daysLate).toBe(30);
    expect(r.interestCents).toBe(Math.round(10_000_00 * PROMPT_PAY_DAILY_RATE * 30));
  });

  it('uses now when paidOn is omitted', () => {
    const now = new Date('2026-03-31T00:00:00Z'); // 59 days past 01-31 due
    const r = caProgressPaymentInterest({
      submittedOn: '2026-01-01',
      unpaidCents: 50_000_00,
      now,
    });
    expect(r.daysLate).toBe(59);
    expect(r.interestCents).toBe(Math.round(50_000_00 * PROMPT_PAY_DAILY_RATE * 59));
  });

  it('clamps negative inputs to 0', () => {
    const r = caProgressPaymentInterest({
      submittedOn: '2026-01-01',
      paidOn: '2026-03-15',
      unpaidCents: -100,
    });
    expect(r.interestCents).toBe(0);
  });
});

describe('buildPromptPayReport', () => {
  it('skips DRAFT, PAID, WRITTEN_OFF — only collectible balances count', () => {
    const r = buildPromptPayReport({
      asOf: '2026-04-15',
      arInvoices: [
        ar({ id: 'd1', status: 'DRAFT' }),
        ar({ id: 'p1', status: 'PAID', paidCents: 100_00 }),
        ar({ id: 'wo1', status: 'WRITTEN_OFF' }),
        ar({ id: 'k1', status: 'SENT' }),
      ],
    });
    expect(r.rows.map((x) => x.invoiceId)).toEqual(['k1']);
  });

  it('skips zero-balance rows', () => {
    const r = buildPromptPayReport({
      asOf: '2026-04-15',
      arInvoices: [
        ar({
          id: 'paid-up',
          status: 'PARTIALLY_PAID',
          totalCents: 100_00,
          paidCents: 100_00,
        }),
      ],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('uses sentAt when present, otherwise falls back to invoiceDate', () => {
    const r = buildPromptPayReport({
      asOf: '2026-04-15',
      arInvoices: [
        ar({ id: 'a', invoiceDate: '2026-01-01', sentAt: '2026-01-10T00:00:00Z' }),
        ar({ id: 'b', invoiceDate: '2026-02-01', sentAt: undefined }),
      ],
    });
    const a = r.rows.find((x) => x.invoiceId === 'a')!;
    const b = r.rows.find((x) => x.invoiceId === 'b')!;
    expect(a.submittedOn).toBe('2026-01-10');
    expect(a.submittedOnSynthesized).toBe(false);
    expect(b.submittedOn).toBe('2026-02-01');
    expect(b.submittedOnSynthesized).toBe(true);
  });

  it('totals unpaid + interest across all rows', () => {
    const r = buildPromptPayReport({
      asOf: '2026-04-15',
      arInvoices: [
        ar({
          id: 'late',
          totalCents: 10_000_00,
          paidCents: 0,
          invoiceDate: '2026-01-01', // submitted same day; due 01-31
        }),
        ar({
          id: 'fresh',
          totalCents: 5_000_00,
          paidCents: 0,
          invoiceDate: '2026-04-10', // due 05-10, not yet late
        }),
      ],
    });
    expect(r.totalUnpaidCents).toBe(15_000_00);
    expect(r.totalInterestCents).toBeGreaterThan(0);
    expect(r.totalDemandCents).toBe(r.totalUnpaidCents + r.totalInterestCents);
    expect(r.overdueRows.map((x) => x.invoiceId)).toEqual(['late']);
  });

  it('uses freshest paid amount when arPayments are passed', () => {
    // Invoice still says paidCents: 0, but a partial payment of 6_000_00
    // came in via arPayments. Unpaid balance should be 4_000_00.
    const r = buildPromptPayReport({
      asOf: '2026-04-15',
      arInvoices: [
        ar({
          id: 'inv-1',
          totalCents: 10_000_00,
          paidCents: 0,
          status: 'PARTIALLY_PAID',
          invoiceDate: '2026-01-01',
        }),
      ],
      arPayments: [
        {
          id: 'pay-1',
          createdAt: '',
          updatedAt: '',
          arInvoiceId: 'inv-1',
          jobId: 'job-1',
          receivedOn: '2026-02-01',
          amountCents: 6_000_00,
          method: 'ACH',
          kind: 'PROGRESS',
        } as ArPayment,
      ],
    });
    expect(r.rows[0]?.unpaidCents).toBe(4_000_00);
  });

  it('sorts most-overdue first', () => {
    const r = buildPromptPayReport({
      asOf: '2026-04-15',
      arInvoices: [
        ar({ id: 'mid', invoiceDate: '2026-02-01' }), // ~74 days, due 03-03
        ar({ id: 'old', invoiceDate: '2026-01-01' }), // ~104 days
        ar({ id: 'fresh', invoiceDate: '2026-04-10' }), // not due yet
      ],
    });
    expect(r.rows.map((x) => x.invoiceId)).toEqual(['old', 'mid', 'fresh']);
  });
});
