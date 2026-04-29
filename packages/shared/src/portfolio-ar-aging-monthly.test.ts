import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';

import { buildPortfolioArAgingMonthly } from './portfolio-ar-aging-monthly';

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    customerName: 'X',
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

function arp(over: Partial<ArPayment>): ArPayment {
  return {
    id: 'arp-1',
    createdAt: '',
    updatedAt: '',
    arInvoiceId: 'ar-1',
    jobId: 'j1',
    kind: 'PROGRESS',
    method: 'CHECK',
    receivedOn: '2026-04-20',
    amountCents: 30_000_00,
    payerName: 'X',
    ...over,
  } as ArPayment;
}

describe('buildPortfolioArAgingMonthly', () => {
  it('produces one row per yyyy-mm in the window', () => {
    const r = buildPortfolioArAgingMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-06',
      arInvoices: [],
      arPayments: [],
    });
    expect(r.rows.map((x) => x.month)).toEqual([
      '2026-04',
      '2026-05',
      '2026-06',
    ]);
  });

  it('buckets open AR by age at month-end', () => {
    const r = buildPortfolioArAgingMonthly({
      fromMonth: '2026-06',
      toMonth: '2026-06',
      arInvoices: [
        ar({ id: 'a', invoiceDate: '2026-06-25' }), // 5 days old → 1-30
        ar({ id: 'b', invoiceDate: '2026-05-15' }), // ~46 days old → 31-60
        ar({ id: 'c', invoiceDate: '2026-04-15' }), // ~76 days old → 61-90
        ar({ id: 'd', invoiceDate: '2026-02-15' }), // ~135 days old → 90+
      ],
      arPayments: [],
    });
    expect(r.rows[0]?.invoiceCount).toBe(4);
    expect(r.rows[0]?.days1to30Cents).toBe(100_000_00);
    expect(r.rows[0]?.days31to60Cents).toBe(100_000_00);
    expect(r.rows[0]?.days61to90Cents).toBe(100_000_00);
    expect(r.rows[0]?.days90PlusCents).toBe(100_000_00);
  });

  it('subtracts payments received on/before snapshot date', () => {
    const r = buildPortfolioArAgingMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      arInvoices: [ar({ id: 'a', totalCents: 100_000_00 })],
      arPayments: [arp({ arInvoiceId: 'a', receivedOn: '2026-04-20', amountCents: 30_000_00 })],
    });
    expect(r.rows[0]?.openCents).toBe(70_000_00);
  });

  it('ignores payments received after snapshot date', () => {
    const r = buildPortfolioArAgingMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      arInvoices: [ar({ id: 'a', invoiceDate: '2026-04-15', totalCents: 100_000_00 })],
      arPayments: [arp({ arInvoiceId: 'a', receivedOn: '2026-05-10', amountCents: 30_000_00 })],
    });
    expect(r.rows[0]?.openCents).toBe(100_000_00);
  });

  it('skips invoices issued after snapshot date', () => {
    const r = buildPortfolioArAgingMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      arInvoices: [ar({ id: 'a', invoiceDate: '2026-05-10', totalCents: 100_000_00 })],
      arPayments: [],
    });
    expect(r.rows[0]?.invoiceCount).toBe(0);
  });

  it('handles empty input window', () => {
    const r = buildPortfolioArAgingMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      arInvoices: [],
      arPayments: [],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.openCents).toBe(0);
  });
});
