import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { ApPayment } from './ap-payment';

import { buildApPaymentByJobMethod } from './ap-payment-by-job-method';

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

describe('buildApPaymentByJobMethod', () => {
  it('groups by (job, method)', () => {
    const r = buildApPaymentByJobMethod({
      apInvoices: [ap({ id: 'i1', jobId: 'j1' }), ap({ id: 'i2', jobId: 'j2' })],
      apPayments: [
        app({ id: 'a', apInvoiceId: 'i1', method: 'CHECK' }),
        app({ id: 'b', apInvoiceId: 'i1', method: 'ACH' }),
        app({ id: 'c', apInvoiceId: 'i2', method: 'CHECK' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('skips voided payments', () => {
    const r = buildApPaymentByJobMethod({
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
    const r = buildApPaymentByJobMethod({
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

  it('sums amountCents per (job, method)', () => {
    const r = buildApPaymentByJobMethod({
      apInvoices: [ap({ id: 'i1', jobId: 'j1' })],
      apPayments: [
        app({ id: 'a', apInvoiceId: 'i1', method: 'CHECK', amountCents: 30_000_00 }),
        app({ id: 'b', apInvoiceId: 'i1', method: 'CHECK', amountCents: 70_000_00 }),
      ],
    });
    expect(r.rows[0]?.amountCents).toBe(100_000_00);
    expect(r.rows[0]?.total).toBe(2);
  });

  it('computes share within job', () => {
    const r = buildApPaymentByJobMethod({
      apInvoices: [ap({ id: 'i1', jobId: 'j1' })],
      apPayments: [
        app({ id: 'a', apInvoiceId: 'i1', method: 'CHECK', amountCents: 80_000_00 }),
        app({ id: 'b', apInvoiceId: 'i1', method: 'ACH', amountCents: 20_000_00 }),
      ],
    });
    const check = r.rows.find((x) => x.method === 'CHECK');
    const ach = r.rows.find((x) => x.method === 'ACH');
    expect(check?.share).toBe(0.8);
    expect(ach?.share).toBeCloseTo(0.2);
  });

  it('respects fromDate / toDate window', () => {
    const r = buildApPaymentByJobMethod({
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

  it('sorts by jobId asc, amountCents desc within job', () => {
    const r = buildApPaymentByJobMethod({
      apInvoices: [ap({ id: 'iA', jobId: 'A' }), ap({ id: 'iZ', jobId: 'Z' })],
      apPayments: [
        app({ id: 'a', apInvoiceId: 'iA', method: 'CHECK', amountCents: 5_000_00 }),
        app({ id: 'b', apInvoiceId: 'iA', method: 'ACH', amountCents: 100_000_00 }),
        app({ id: 'c', apInvoiceId: 'iZ', method: 'CHECK', amountCents: 50_000_00 }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('A');
    expect(r.rows[0]?.method).toBe('ACH');
    expect(r.rows[2]?.jobId).toBe('Z');
  });

  it('handles empty input', () => {
    const r = buildApPaymentByJobMethod({ apInvoices: [], apPayments: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalPayments).toBe(0);
  });
});
