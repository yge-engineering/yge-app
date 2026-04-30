import { describe, expect, it } from 'vitest';

import type { ArPayment } from './ar-payment';

import { buildPortfolioCustomerPaymentYoy } from './portfolio-customer-payment-yoy';

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
    payerName: 'CAL FIRE',
    ...over,
  } as ArPayment;
}

describe('buildPortfolioCustomerPaymentYoy', () => {
  it('compares prior vs current totals + delta', () => {
    const r = buildPortfolioCustomerPaymentYoy({
      currentYear: 2026,
      arPayments: [
        arp({ id: 'a', receivedOn: '2025-04-15', amountCents: 50_000_00 }),
        arp({ id: 'b', receivedOn: '2026-04-15', amountCents: 100_000_00 }),
      ],
    });
    expect(r.priorTotalCents).toBe(50_000_00);
    expect(r.currentTotalCents).toBe(100_000_00);
    expect(r.totalCentsDelta).toBe(50_000_00);
  });

  it('breaks down by method + kind', () => {
    const r = buildPortfolioCustomerPaymentYoy({
      currentYear: 2026,
      arPayments: [
        arp({ id: 'a', method: 'CHECK', kind: 'PROGRESS' }),
        arp({ id: 'b', method: 'ACH', kind: 'RETENTION_RELEASE' }),
        arp({ id: 'c', method: 'CHECK', kind: 'PROGRESS' }),
      ],
    });
    expect(r.currentByMethod.CHECK).toBe(2);
    expect(r.currentByMethod.ACH).toBe(1);
    expect(r.currentByKind.PROGRESS).toBe(2);
    expect(r.currentByKind.RETENTION_RELEASE).toBe(1);
  });

  it('counts distinct payers + jobs', () => {
    const r = buildPortfolioCustomerPaymentYoy({
      currentYear: 2026,
      arPayments: [
        arp({ id: 'a', payerName: 'CAL FIRE', jobId: 'j1' }),
        arp({ id: 'b', payerName: 'Caltrans', jobId: 'j2' }),
      ],
    });
    expect(r.currentDistinctPayers).toBe(2);
    expect(r.currentDistinctJobs).toBe(2);
  });

  it('handles empty input', () => {
    const r = buildPortfolioCustomerPaymentYoy({ currentYear: 2026, arPayments: [] });
    expect(r.currentTotalCents).toBe(0);
  });
});
