import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { ApPayment } from './ap-payment';

import { buildApPaymentByJob } from './ap-payment-by-job';

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    vendorName: 'Granite',
    invoiceDate: '2026-04-15',
    jobId: 'j1',
    lineItems: [],
    totalCents: 50_000_00,
    paidCents: 0,
    status: 'PENDING',
    ...over,
  } as ApInvoice;
}

function app(over: Partial<ApPayment>): ApPayment {
  return {
    id: 'app-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    apInvoiceId: 'ap-1',
    vendorName: 'Granite',
    method: 'CHECK',
    paidOn: '2026-04-15',
    amountCents: 50_000_00,
    cleared: false,
    voided: false,
    ...over,
  } as ApPayment;
}

describe('buildApPaymentByJob', () => {
  it('joins payments to jobs via AP invoice', () => {
    const r = buildApPaymentByJob({
      apInvoices: [
        ap({ id: 'i1', jobId: 'j1' }),
        ap({ id: 'i2', jobId: 'j2' }),
      ],
      apPayments: [
        app({ id: 'a', apInvoiceId: 'i1' }),
        app({ id: 'b', apInvoiceId: 'i2' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('skips voided payments', () => {
    const r = buildApPaymentByJob({
      apInvoices: [ap({ id: 'i1' })],
      apPayments: [
        app({ id: 'live', apInvoiceId: 'i1' }),
        app({ id: 'gone', apInvoiceId: 'i1', voided: true }),
      ],
    });
    expect(r.rollup.totalPayments).toBe(1);
    expect(r.rollup.voidedSkipped).toBe(1);
  });

  it('counts unattributed (no invoice match or invoice has no jobId)', () => {
    const r = buildApPaymentByJob({
      apInvoices: [
        ap({ id: 'i1', jobId: 'j1' }),
        ap({ id: 'i2', jobId: undefined }),
      ],
      apPayments: [
        app({ id: 'a', apInvoiceId: 'i1' }),
        app({ id: 'b', apInvoiceId: 'i2' }),
        app({ id: 'c', apInvoiceId: 'orphan' }),
      ],
    });
    expect(r.rollup.unattributed).toBe(2);
  });

  it('breaks down by method', () => {
    const r = buildApPaymentByJob({
      apInvoices: [ap({ id: 'i1' })],
      apPayments: [
        app({ id: 'a', apInvoiceId: 'i1', method: 'CHECK' }),
        app({ id: 'b', apInvoiceId: 'i1', method: 'ACH' }),
      ],
    });
    expect(r.rows[0]?.byMethod.CHECK).toBe(1);
    expect(r.rows[0]?.byMethod.ACH).toBe(1);
  });

  it('tracks last paidOn', () => {
    const r = buildApPaymentByJob({
      apInvoices: [ap({ id: 'i1' })],
      apPayments: [
        app({ id: 'a', apInvoiceId: 'i1', paidOn: '2026-04-10' }),
        app({ id: 'b', apInvoiceId: 'i1', paidOn: '2026-04-20' }),
      ],
    });
    expect(r.rows[0]?.lastPaidOn).toBe('2026-04-20');
  });

  it('respects fromDate / toDate window', () => {
    const r = buildApPaymentByJob({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      apInvoices: [ap({ id: 'i1' })],
      apPayments: [
        app({ id: 'old', apInvoiceId: 'i1', paidOn: '2026-03-15' }),
        app({ id: 'in', apInvoiceId: 'i1', paidOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalPayments).toBe(1);
  });

  it('sorts by totalCents desc', () => {
    const r = buildApPaymentByJob({
      apInvoices: [
        ap({ id: 's', jobId: 'small' }),
        ap({ id: 'b', jobId: 'big' }),
      ],
      apPayments: [
        app({ id: 'a', apInvoiceId: 's', amountCents: 5_000_00 }),
        app({ id: 'b', apInvoiceId: 'b', amountCents: 100_000_00 }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('big');
  });

  it('handles empty input', () => {
    const r = buildApPaymentByJob({ apInvoices: [], apPayments: [] });
    expect(r.rows).toHaveLength(0);
  });
});
