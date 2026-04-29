import { describe, expect, it } from 'vitest';

import type { ApPayment } from './ap-payment';
import type { ArPayment } from './ar-payment';

import { buildPortfolioCashNetYoy } from './portfolio-cash-net-yoy';

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

describe('buildPortfolioCashNetYoy', () => {
  it('computes net per year + delta', () => {
    const r = buildPortfolioCashNetYoy({
      currentYear: 2026,
      arPayments: [
        arp({ id: 'a', receivedOn: '2025-04-15', amountCents: 80_000_00 }),
        arp({ id: 'b', receivedOn: '2026-04-15', amountCents: 100_000_00 }),
      ],
      apPayments: [
        app({ id: 'x', paidOn: '2025-04-15', amountCents: 20_000_00 }),
        app({ id: 'y', paidOn: '2026-04-15', amountCents: 30_000_00 }),
      ],
    });
    expect(r.priorNetCents).toBe(60_000_00);
    expect(r.currentNetCents).toBe(70_000_00);
    expect(r.netCentsDelta).toBe(10_000_00);
  });

  it('skips voided AP', () => {
    const r = buildPortfolioCashNetYoy({
      currentYear: 2026,
      arPayments: [],
      apPayments: [
        app({ id: 'a', voided: true }),
      ],
    });
    expect(r.voidedSkipped).toBe(1);
    expect(r.currentPaymentsCents).toBe(0);
  });

  it('ignores out-of-window dates', () => {
    const r = buildPortfolioCashNetYoy({
      currentYear: 2026,
      arPayments: [arp({ id: 'old', receivedOn: '2024-04-15' })],
      apPayments: [],
    });
    expect(r.priorReceiptsCents).toBe(0);
    expect(r.currentReceiptsCents).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioCashNetYoy({
      currentYear: 2026,
      arPayments: [],
      apPayments: [],
    });
    expect(r.priorNetCents).toBe(0);
    expect(r.currentNetCents).toBe(0);
  });
});
