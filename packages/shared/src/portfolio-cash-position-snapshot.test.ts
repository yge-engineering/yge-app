import { describe, expect, it } from 'vitest';

import type { ApPayment } from './ap-payment';
import type { ArPayment } from './ar-payment';

import { buildPortfolioCashPositionSnapshot } from './portfolio-cash-position-snapshot';

function arp(over: Partial<ArPayment>): ArPayment {
  return {
    id: 'arp-1',
    createdAt: '',
    updatedAt: '',
    arInvoiceId: 'ar-1',
    jobId: 'j1',
    kind: 'PROGRESS',
    method: 'CHECK',
    receivedOn: '2026-04-15',
    amountCents: 100_000_00,
    payerName: 'X',
    ...over,
  } as ArPayment;
}

function app(over: Partial<ApPayment>): ApPayment {
  return {
    id: 'app-1',
    createdAt: '',
    updatedAt: '',
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

describe('buildPortfolioCashPositionSnapshot', () => {
  it('sums receipts + payments + net', () => {
    const r = buildPortfolioCashPositionSnapshot({
      asOf: '2026-04-30',
      arPayments: [arp({ amountCents: 100_000_00 })],
      apPayments: [app({ amountCents: 30_000_00 })],
    });
    expect(r.receiptsCents).toBe(100_000_00);
    expect(r.paymentsCents).toBe(30_000_00);
    expect(r.netCents).toBe(70_000_00);
  });

  it('skips voided AP', () => {
    const r = buildPortfolioCashPositionSnapshot({
      asOf: '2026-04-30',
      arPayments: [],
      apPayments: [
        app({ id: 'live' }),
        app({ id: 'gone', voided: true }),
      ],
    });
    expect(r.voidedSkipped).toBe(1);
    expect(r.paymentsCents).toBe(30_000_00);
  });

  it('ignores transactions after asOf', () => {
    const r = buildPortfolioCashPositionSnapshot({
      asOf: '2026-04-30',
      arPayments: [arp({ id: 'late', receivedOn: '2026-05-15' })],
      apPayments: [app({ id: 'late', paidOn: '2026-05-15' })],
    });
    expect(r.receiptsCents).toBe(0);
    expect(r.paymentsCents).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioCashPositionSnapshot({
      asOf: '2026-04-30',
      arPayments: [],
      apPayments: [],
    });
    expect(r.netCents).toBe(0);
  });
});
