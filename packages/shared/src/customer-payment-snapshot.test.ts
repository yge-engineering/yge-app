import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';

import { buildCustomerPaymentSnapshot } from './customer-payment-snapshot';

function inv(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'inv-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    customerName: 'Caltrans',
    invoiceDate: '2026-04-15',
    invoiceNumber: '1',
    lineItems: [],
    subtotalCents: 0,
    totalCents: 100_000_00,
    paidCents: 0,
    status: 'SENT',
    source: 'MANUAL',
    ...over,
  } as ArInvoice;
}

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

describe('buildCustomerPaymentSnapshot', () => {
  it('matches via payerName', () => {
    const r = buildCustomerPaymentSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      arInvoices: [],
      arPayments: [
        pay({ id: 'a', payerName: 'Caltrans', amountCents: 50_000_00 }),
        pay({ id: 'b', payerName: 'CAL FIRE', amountCents: 25_000_00 }),
      ],
    });
    expect(r.totalPayments).toBe(1);
    expect(r.totalCents).toBe(50_000_00);
  });

  it('matches via invoice customer (when payerName missing)', () => {
    const r = buildCustomerPaymentSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      arInvoices: [inv({ id: 'inv-1', customerName: 'Caltrans' })],
      arPayments: [
        pay({ id: 'a', arInvoiceId: 'inv-1', payerName: undefined, amountCents: 50_000_00 }),
      ],
    });
    expect(r.totalPayments).toBe(1);
  });

  it('counts ytd', () => {
    const r = buildCustomerPaymentSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      logYear: 2026,
      arInvoices: [],
      arPayments: [
        pay({ id: 'a', receivedOn: '2025-04-15', amountCents: 100_000_00 }),
        pay({ id: 'b', receivedOn: '2026-04-15', amountCents: 50_000_00 }),
      ],
    });
    expect(r.ytdPayments).toBe(1);
    expect(r.ytdCents).toBe(50_000_00);
  });

  it('breaks down by kind + method', () => {
    const r = buildCustomerPaymentSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      arInvoices: [],
      arPayments: [
        pay({ id: 'a', kind: 'PROGRESS', method: 'CHECK' }),
        pay({ id: 'b', kind: 'RETENTION_RELEASE', method: 'ACH' }),
      ],
    });
    expect(r.byKind.PROGRESS).toBe(1);
    expect(r.byKind.RETENTION_RELEASE).toBe(1);
    expect(r.byMethod.CHECK).toBe(1);
    expect(r.byMethod.ACH).toBe(1);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerPaymentSnapshot({
      customerName: 'NonExistent',
      arInvoices: [],
      arPayments: [],
    });
    expect(r.totalPayments).toBe(0);
  });
});
