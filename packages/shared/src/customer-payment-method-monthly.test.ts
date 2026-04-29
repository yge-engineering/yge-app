import { describe, expect, it } from 'vitest';

import type { ArPayment } from './ar-payment';

import { buildCustomerPaymentMethodMonthly } from './customer-payment-method-monthly';

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

describe('buildCustomerPaymentMethodMonthly', () => {
  it('buckets by yyyy-mm of receivedOn', () => {
    const r = buildCustomerPaymentMethodMonthly({
      arPayments: [
        arp({ id: 'a', receivedOn: '2026-03-15' }),
        arp({ id: 'b', receivedOn: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('breaks down dollar amounts by method', () => {
    const r = buildCustomerPaymentMethodMonthly({
      arPayments: [
        arp({ id: 'a', method: 'CHECK', amountCents: 30_000_00 }),
        arp({ id: 'b', method: 'ACH', amountCents: 70_000_00 }),
        arp({ id: 'c', method: 'WIRE', amountCents: 100_000_00 }),
      ],
    });
    expect(r.rows[0]?.checkAmountCents).toBe(30_000_00);
    expect(r.rows[0]?.achAmountCents).toBe(70_000_00);
    expect(r.rows[0]?.wireAmountCents).toBe(100_000_00);
  });

  it('counts methods', () => {
    const r = buildCustomerPaymentMethodMonthly({
      arPayments: [
        arp({ id: 'a', method: 'CHECK' }),
        arp({ id: 'b', method: 'CHECK' }),
        arp({ id: 'c', method: 'ACH' }),
      ],
    });
    expect(r.rows[0]?.byMethod.CHECK).toBe(2);
    expect(r.rows[0]?.byMethod.ACH).toBe(1);
  });

  it('counts distinct customers', () => {
    const r = buildCustomerPaymentMethodMonthly({
      arPayments: [
        arp({ id: 'a', payerName: 'CAL FIRE' }),
        arp({ id: 'b', payerName: 'Cal Fire, Inc.' }),
        arp({ id: 'c', payerName: 'BLM' }),
      ],
    });
    expect(r.rows[0]?.distinctCustomers).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildCustomerPaymentMethodMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      arPayments: [
        arp({ id: 'mar', receivedOn: '2026-03-15' }),
        arp({ id: 'apr', receivedOn: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sorts by month asc', () => {
    const r = buildCustomerPaymentMethodMonthly({
      arPayments: [
        arp({ id: 'late', receivedOn: '2026-04-15' }),
        arp({ id: 'early', receivedOn: '2026-02-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-02');
  });

  it('handles empty input', () => {
    const r = buildCustomerPaymentMethodMonthly({ arPayments: [] });
    expect(r.rows).toHaveLength(0);
  });
});
