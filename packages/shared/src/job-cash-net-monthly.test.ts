import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { ApPayment } from './ap-payment';
import type { ArPayment } from './ar-payment';

import { buildJobCashNetMonthly } from './job-cash-net-monthly';

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    vendorName: 'V',
    invoiceDate: '2026-04-15',
    jobId: 'j1',
    lineItems: [],
    totalCents: 50_000_00,
    paidCents: 0,
    status: 'PENDING',
    ...over,
  } as ApInvoice;
}

function arp(over: Partial<ArPayment>): ArPayment {
  return {
    id: 'arp-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    arInvoiceId: 'ar-1',
    jobId: 'j1',
    kind: 'PROGRESS',
    method: 'CHECK',
    receivedOn: '2026-04-15',
    amountCents: 100_000_00,
    payerName: 'CAL FIRE',
    ...over,
  } as ArPayment;
}

function app(over: Partial<ApPayment>): ApPayment {
  return {
    id: 'app-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    apInvoiceId: 'ap-1',
    vendorName: 'V',
    method: 'CHECK',
    paidOn: '2026-04-15',
    amountCents: 30_000_00,
    cleared: false,
    voided: false,
    ...over,
  } as ApPayment;
}

describe('buildJobCashNetMonthly', () => {
  it('computes receipts, payments, net per (job, month)', () => {
    const r = buildJobCashNetMonthly({
      apInvoices: [ap({ id: 'ap-1', jobId: 'j1' })],
      arPayments: [arp({ jobId: 'j1', amountCents: 100_000_00 })],
      apPayments: [app({ apInvoiceId: 'ap-1', amountCents: 30_000_00 })],
    });
    expect(r.rows[0]?.receiptsCents).toBe(100_000_00);
    expect(r.rows[0]?.paymentsCents).toBe(30_000_00);
    expect(r.rows[0]?.netCents).toBe(70_000_00);
  });

  it('skips voided AP payments', () => {
    const r = buildJobCashNetMonthly({
      apInvoices: [ap({ id: 'ap-1', jobId: 'j1' })],
      arPayments: [],
      apPayments: [app({ apInvoiceId: 'ap-1', voided: true })],
    });
    expect(r.rollup.paymentsCents).toBe(0);
  });

  it('skips AR payments with no jobId and AP payments with no invoice match', () => {
    const r = buildJobCashNetMonthly({
      apInvoices: [],
      arPayments: [arp({ jobId: undefined })],
      apPayments: [app({ apInvoiceId: 'orphan' })],
    });
    expect(r.rollup.jobsConsidered).toBe(0);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildJobCashNetMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      apInvoices: [ap({ id: 'ap-1', jobId: 'j1' })],
      arPayments: [
        arp({ id: 'mar', jobId: 'j1', receivedOn: '2026-03-15' }),
        arp({ id: 'apr', jobId: 'j1', receivedOn: '2026-04-15' }),
      ],
      apPayments: [],
    });
    expect(r.rollup.monthsConsidered).toBe(1);
  });

  it('groups by (job, month)', () => {
    const r = buildJobCashNetMonthly({
      apInvoices: [],
      arPayments: [
        arp({ id: 'a', jobId: 'j1', receivedOn: '2026-04-15' }),
        arp({ id: 'b', jobId: 'j1', receivedOn: '2026-03-15' }),
        arp({ id: 'c', jobId: 'j2', receivedOn: '2026-04-15' }),
      ],
      apPayments: [],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('sorts by jobId asc, month asc', () => {
    const r = buildJobCashNetMonthly({
      apInvoices: [],
      arPayments: [
        arp({ id: 'a', jobId: 'Z', receivedOn: '2026-04-15' }),
        arp({ id: 'b', jobId: 'A', receivedOn: '2026-04-15' }),
        arp({ id: 'c', jobId: 'A', receivedOn: '2026-03-15' }),
      ],
      apPayments: [],
    });
    expect(r.rows[0]?.jobId).toBe('A');
    expect(r.rows[0]?.month).toBe('2026-03');
  });

  it('handles empty input', () => {
    const r = buildJobCashNetMonthly({ apInvoices: [], arPayments: [], apPayments: [] });
    expect(r.rows).toHaveLength(0);
  });
});
