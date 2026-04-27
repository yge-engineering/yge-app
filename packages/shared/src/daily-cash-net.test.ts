import { describe, expect, it } from 'vitest';

import type { ApPayment } from './ap-payment';
import type { ArPayment } from './ar-payment';

import { buildDailyCashNet } from './daily-cash-net';

function ar(over: Partial<ArPayment>): ArPayment {
  return {
    id: 'arp-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    arInvoiceId: 'ar-1',
    jobId: 'job-1',
    kind: 'PROGRESS',
    method: 'CHECK',
    receivedOn: '2026-04-15',
    amountCents: 50_000_00,
    ...over,
  } as ArPayment;
}

function ap(over: Partial<ApPayment>): ApPayment {
  return {
    id: 'app-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    apInvoiceId: 'ap-1',
    vendorName: 'Acme Supply',
    method: 'CHECK',
    paidOn: '2026-04-15',
    amountCents: 20_000_00,
  } as ApPayment;
}

describe('buildDailyCashNet', () => {
  it('respects window bounds', () => {
    const r = buildDailyCashNet({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arPayments: [
        ar({ id: 'a-old', receivedOn: '2026-03-15' }),
        ar({ id: 'a-in', receivedOn: '2026-04-15' }),
      ],
      apPayments: [],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('groups by date with separate receipts and payments', () => {
    const r = buildDailyCashNet({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arPayments: [
        ar({ id: 'a-1', receivedOn: '2026-04-15', amountCents: 30_000_00 }),
      ],
      apPayments: [
        ap({ id: 'p-1', paidOn: '2026-04-15', amountCents: 10_000_00 }),
      ],
    });
    expect(r.rows[0]?.receiptsCents).toBe(30_000_00);
    expect(r.rows[0]?.paymentsCents).toBe(10_000_00);
    expect(r.rows[0]?.netCents).toBe(20_000_00);
  });

  it('counts payments and receipts separately', () => {
    const r = buildDailyCashNet({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arPayments: [
        ar({ id: 'a-1', receivedOn: '2026-04-15' }),
        ar({ id: 'a-2', receivedOn: '2026-04-15' }),
      ],
      apPayments: [
        ap({ id: 'p-1', paidOn: '2026-04-15' }),
        ap({ id: 'p-2', paidOn: '2026-04-15' }),
        ap({ id: 'p-3', paidOn: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.receiptCount).toBe(2);
    expect(r.rows[0]?.paymentCount).toBe(3);
  });

  it('builds a running cumulative net', () => {
    const r = buildDailyCashNet({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arPayments: [
        ar({ id: 'a-1', receivedOn: '2026-04-01', amountCents: 100_00 }),
        ar({ id: 'a-2', receivedOn: '2026-04-02', amountCents: 50_00 }),
      ],
      apPayments: [
        ap({ id: 'p-1', paidOn: '2026-04-02', amountCents: 30_00 }),
      ],
    });
    expect(r.rows[0]?.cumulativeNetCents).toBe(100_00);
    expect(r.rows[1]?.cumulativeNetCents).toBe(120_00);
  });

  it('captures trough date and value', () => {
    const r = buildDailyCashNet({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arPayments: [],
      apPayments: [
        ap({ id: 'p-1', paidOn: '2026-04-05', amountCents: 50_000_00 }),
        ap({ id: 'p-2', paidOn: '2026-04-15', amountCents: 30_000_00 }),
      ],
    });
    // Cumulative: -50K, then -80K → trough at 2026-04-15
    expect(r.rollup.troughDate).toBe('2026-04-15');
    expect(r.rollup.troughCumulativeNetCents).toBe(-80_000_00);
  });

  it('rolls up totals + net', () => {
    const r = buildDailyCashNet({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arPayments: [
        ar({ id: 'a-1', receivedOn: '2026-04-15', amountCents: 100_000_00 }),
      ],
      apPayments: [
        ap({ id: 'p-1', paidOn: '2026-04-20', amountCents: 30_000_00 }),
      ],
    });
    expect(r.rollup.totalReceiptsCents).toBe(100_000_00);
    expect(r.rollup.totalPaymentsCents).toBe(30_000_00);
    expect(r.rollup.netCents).toBe(70_000_00);
  });

  it('sorts rows by date asc', () => {
    const r = buildDailyCashNet({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arPayments: [
        ar({ id: 'a-late', receivedOn: '2026-04-25' }),
        ar({ id: 'a-early', receivedOn: '2026-04-05' }),
      ],
      apPayments: [],
    });
    expect(r.rows[0]?.date).toBe('2026-04-05');
    expect(r.rows[1]?.date).toBe('2026-04-25');
  });

  it('handles empty input gracefully', () => {
    const r = buildDailyCashNet({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arPayments: [],
      apPayments: [],
    });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.troughDate).toBe(null);
    expect(r.rollup.netCents).toBe(0);
  });
});
