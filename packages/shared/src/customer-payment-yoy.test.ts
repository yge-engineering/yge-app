import { describe, expect, it } from 'vitest';

import type { ArPayment } from './ar-payment';

import { buildCustomerPaymentYoy } from './customer-payment-yoy';

function pay(over: Partial<ArPayment>): ArPayment {
  return {
    id: 'arp-1',
    createdAt: '',
    updatedAt: '',
    arInvoiceId: 'inv-1',
    jobId: 'j1',
    kind: 'PROGRESS',
    method: 'CHECK',
    receivedOn: '2026-04-15',
    amountCents: 50_000_00,
    payerName: 'Caltrans',
    ...over,
  } as ArPayment;
}

describe('buildCustomerPaymentYoy', () => {
  it('compares two years for one customer', () => {
    const r = buildCustomerPaymentYoy({
      customerName: 'Caltrans',
      currentYear: 2026,
      arInvoices: [],
      arPayments: [
        pay({ id: 'a', receivedOn: '2025-04-15', amountCents: 50_000_00 }),
        pay({ id: 'b', receivedOn: '2026-04-15', amountCents: 100_000_00 }),
      ],
    });
    expect(r.priorTotal).toBe(1);
    expect(r.currentTotal).toBe(1);
    expect(r.centsDelta).toBe(50_000_00);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerPaymentYoy({
      customerName: 'X',
      currentYear: 2026,
      arInvoices: [],
      arPayments: [],
    });
    expect(r.priorTotal).toBe(0);
  });
});
