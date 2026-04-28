import { describe, expect, it } from 'vitest';

import type { ApPayment } from './ap-payment';
import type { ArPayment } from './ar-payment';

import { buildMonthlyCashNet } from './monthly-cash-net';

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
    ...over,
  } as ArPayment;
}

function app(over: Partial<ApPayment>): ApPayment {
  return {
    id: 'app-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    apInvoiceId: 'ap-1',
    vendorName: 'Test',
    method: 'CHECK',
    paidOn: '2026-04-15',
    amountCents: 50_000_00,
    cleared: false,
    voided: false,
    ...over,
  } as ApPayment;
}

describe('buildMonthlyCashNet', () => {
  it('buckets receipts + payments by yyyy-mm', () => {
    const r = buildMonthlyCashNet({
      arPayments: [
        arp({ id: 'a', receivedOn: '2026-03-15' }),
        arp({ id: 'b', receivedOn: '2026-04-15' }),
      ],
      apPayments: [
        app({ id: 'c', paidOn: '2026-03-20' }),
        app({ id: 'd', paidOn: '2026-04-20' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('computes netCents as receipts - payments per month', () => {
    const r = buildMonthlyCashNet({
      arPayments: [arp({ id: 'a', amountCents: 100_000_00 })],
      apPayments: [app({ id: 'b', amountCents: 30_000_00 })],
    });
    expect(r.rows[0]?.netCents).toBe(70_000_00);
  });

  it('skips voided AP payments', () => {
    const r = buildMonthlyCashNet({
      arPayments: [],
      apPayments: [
        app({ id: 'live', amountCents: 10_000_00 }),
        app({ id: 'gone', amountCents: 99_000_00, voided: true }),
      ],
    });
    expect(r.rows[0]?.paymentsCents).toBe(10_000_00);
    expect(r.rows[0]?.paymentCount).toBe(1);
  });

  it('computes cumulative net across months', () => {
    const r = buildMonthlyCashNet({
      arPayments: [
        arp({ id: 'a', receivedOn: '2026-03-15', amountCents: 50_000_00 }),
        arp({ id: 'b', receivedOn: '2026-04-15', amountCents: 30_000_00 }),
      ],
      apPayments: [
        app({ id: 'c', paidOn: '2026-04-15', amountCents: 80_000_00 }),
      ],
    });
    expect(r.rows[0]?.cumulativeNetCents).toBe(50_000_00);
    expect(r.rows[1]?.cumulativeNetCents).toBe(0);
  });

  it('respects fromMonth / toMonth bounds', () => {
    const r = buildMonthlyCashNet({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      arPayments: [
        arp({ id: 'mar', receivedOn: '2026-03-15' }),
        arp({ id: 'apr', receivedOn: '2026-04-15' }),
      ],
      apPayments: [],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('rolls up portfolio totals + month-over-month net change', () => {
    const r = buildMonthlyCashNet({
      arPayments: [
        arp({ id: 'mar', receivedOn: '2026-03-15', amountCents: 10_000_00 }),
        arp({ id: 'apr', receivedOn: '2026-04-15', amountCents: 50_000_00 }),
      ],
      apPayments: [],
    });
    expect(r.rollup.receiptsCents).toBe(60_000_00);
    expect(r.rollup.netCents).toBe(60_000_00);
    expect(r.rollup.monthOverMonthNetChange).toBe(40_000_00);
  });

  it('sorts by month ascending', () => {
    const r = buildMonthlyCashNet({
      arPayments: [
        arp({ id: 'late', receivedOn: '2026-04-15' }),
        arp({ id: 'early', receivedOn: '2026-02-15' }),
      ],
      apPayments: [],
    });
    expect(r.rows[0]?.month).toBe('2026-02');
  });

  it('handles empty input', () => {
    const r = buildMonthlyCashNet({ arPayments: [], apPayments: [] });
    expect(r.rows).toHaveLength(0);
  });
});
