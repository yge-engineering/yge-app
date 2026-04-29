import { describe, expect, it } from 'vitest';

import type { ArPayment } from './ar-payment';

import { buildPortfolioCustomerPaymentMonthly } from './portfolio-customer-payment-monthly';

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

describe('buildPortfolioCustomerPaymentMonthly', () => {
  it('splits cents by method', () => {
    const r = buildPortfolioCustomerPaymentMonthly({
      arPayments: [
        arp({ id: 'a', method: 'CHECK', amountCents: 50_000_00 }),
        arp({ id: 'b', method: 'ACH', amountCents: 30_000_00 }),
        arp({ id: 'c', method: 'WIRE', amountCents: 10_000_00 }),
        arp({ id: 'd', method: 'CARD', amountCents: 5_000_00 }),
        arp({ id: 'e', method: 'CASH', amountCents: 1_000_00 }),
      ],
    });
    expect(r.rows[0]?.checkCents).toBe(50_000_00);
    expect(r.rows[0]?.achCents).toBe(30_000_00);
    expect(r.rows[0]?.wireCents).toBe(10_000_00);
    expect(r.rows[0]?.cardCents).toBe(5_000_00);
    expect(r.rows[0]?.cashCents).toBe(1_000_00);
  });

  it('breaks down by kind', () => {
    const r = buildPortfolioCustomerPaymentMonthly({
      arPayments: [
        arp({ id: 'a', kind: 'PROGRESS' }),
        arp({ id: 'b', kind: 'RETENTION_RELEASE' }),
        arp({ id: 'c', kind: 'PROGRESS' }),
      ],
    });
    expect(r.rows[0]?.byKind.PROGRESS).toBe(2);
    expect(r.rows[0]?.byKind.RETENTION_RELEASE).toBe(1);
  });

  it('counts distinct payers + jobs', () => {
    const r = buildPortfolioCustomerPaymentMonthly({
      arPayments: [
        arp({ id: 'a', payerName: 'CAL FIRE', jobId: 'j1' }),
        arp({ id: 'b', payerName: 'Caltrans', jobId: 'j2' }),
        arp({ id: 'c', payerName: 'CAL FIRE', jobId: 'j1' }),
      ],
    });
    expect(r.rows[0]?.distinctPayers).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildPortfolioCustomerPaymentMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      arPayments: [
        arp({ id: 'old', receivedOn: '2026-03-15' }),
        arp({ id: 'in', receivedOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalPayments).toBe(1);
  });

  it('sorts by month asc', () => {
    const r = buildPortfolioCustomerPaymentMonthly({
      arPayments: [
        arp({ id: 'a', receivedOn: '2026-06-15' }),
        arp({ id: 'b', receivedOn: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[1]?.month).toBe('2026-06');
  });

  it('handles empty input', () => {
    const r = buildPortfolioCustomerPaymentMonthly({ arPayments: [] });
    expect(r.rows).toHaveLength(0);
  });
});
