import { describe, expect, it } from 'vitest';

import type { ArPayment } from './ar-payment';

import { buildCustomerPaymentByCustomerMonthly } from './customer-payment-by-customer-monthly';

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

describe('buildCustomerPaymentByCustomerMonthly', () => {
  it('groups by (customer, month)', () => {
    const r = buildCustomerPaymentByCustomerMonthly({
      arPayments: [
        arp({ id: 'a', payerName: 'A', receivedOn: '2026-03-15' }),
        arp({ id: 'b', payerName: 'A', receivedOn: '2026-04-15' }),
        arp({ id: 'c', payerName: 'B', receivedOn: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('sums totalCents and counts payments', () => {
    const r = buildCustomerPaymentByCustomerMonthly({
      arPayments: [
        arp({ id: 'a', amountCents: 30_000_00 }),
        arp({ id: 'b', amountCents: 20_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalCents).toBe(50_000_00);
    expect(r.rows[0]?.paymentCount).toBe(2);
  });

  it('counts distinct methods', () => {
    const r = buildCustomerPaymentByCustomerMonthly({
      arPayments: [
        arp({ id: 'a', method: 'CHECK' }),
        arp({ id: 'b', method: 'WIRE' }),
        arp({ id: 'c', method: 'CHECK' }),
      ],
    });
    expect(r.rows[0]?.distinctMethods).toBe(2);
  });

  it('canonicalizes payerName', () => {
    const r = buildCustomerPaymentByCustomerMonthly({
      arPayments: [
        arp({ id: 'a', payerName: 'CAL FIRE' }),
        arp({ id: 'b', payerName: 'Cal Fire, Inc.' }),
      ],
    });
    expect(r.rollup.customersConsidered).toBe(1);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildCustomerPaymentByCustomerMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      arPayments: [
        arp({ id: 'mar', receivedOn: '2026-03-15' }),
        arp({ id: 'apr', receivedOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.monthsConsidered).toBe(1);
  });

  it('sorts by customer asc, month asc', () => {
    const r = buildCustomerPaymentByCustomerMonthly({
      arPayments: [
        arp({ id: 'a', payerName: 'Z', receivedOn: '2026-04-15' }),
        arp({ id: 'b', payerName: 'A', receivedOn: '2026-04-15' }),
        arp({ id: 'c', payerName: 'A', receivedOn: '2026-03-15' }),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('A');
    expect(r.rows[0]?.month).toBe('2026-03');
  });

  it('handles empty input', () => {
    const r = buildCustomerPaymentByCustomerMonthly({ arPayments: [] });
    expect(r.rows).toHaveLength(0);
  });
});
