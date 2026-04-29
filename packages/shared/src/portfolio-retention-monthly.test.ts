import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';

import { buildPortfolioRetentionMonthly } from './portfolio-retention-monthly';

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
    retentionCents: 5_000_00,
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
    kind: 'RETENTION_RELEASE',
    method: 'CHECK',
    receivedOn: '2026-05-15',
    amountCents: 3_000_00,
    payerName: 'X',
    ...over,
  } as ArPayment;
}

describe('buildPortfolioRetentionMonthly', () => {
  it('produces one row per yyyy-mm in the window', () => {
    const r = buildPortfolioRetentionMonthly({
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

  it('sums retentionCents across invoices on/before snapshot', () => {
    const r = buildPortfolioRetentionMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      arInvoices: [
        ar({ id: 'a', retentionCents: 5_000_00 }),
        ar({ id: 'b', retentionCents: 2_000_00 }),
      ],
      arPayments: [],
    });
    expect(r.rows[0]?.heldCents).toBe(7_000_00);
    expect(r.rows[0]?.invoiceCount).toBe(2);
  });

  it('subtracts RETENTION_RELEASE payments received on/before snapshot', () => {
    const r = buildPortfolioRetentionMonthly({
      fromMonth: '2026-05',
      toMonth: '2026-05',
      arInvoices: [ar({ id: 'a', retentionCents: 5_000_00, invoiceDate: '2026-04-15' })],
      arPayments: [arp({ kind: 'RETENTION_RELEASE', receivedOn: '2026-05-15', amountCents: 3_000_00 })],
    });
    expect(r.rows[0]?.heldCents).toBe(5_000_00);
    expect(r.rows[0]?.releasedCents).toBe(3_000_00);
    expect(r.rows[0]?.netHeldCents).toBe(2_000_00);
  });

  it('ignores non-RETENTION_RELEASE payments', () => {
    const r = buildPortfolioRetentionMonthly({
      fromMonth: '2026-05',
      toMonth: '2026-05',
      arInvoices: [ar({ id: 'a', retentionCents: 5_000_00 })],
      arPayments: [arp({ kind: 'PROGRESS' })],
    });
    expect(r.rows[0]?.releasedCents).toBe(0);
  });

  it('skips invoices issued after snapshot date', () => {
    const r = buildPortfolioRetentionMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      arInvoices: [ar({ id: 'a', invoiceDate: '2026-05-15' })],
      arPayments: [],
    });
    expect(r.rows[0]?.invoiceCount).toBe(0);
  });

  it('handles empty input window', () => {
    const r = buildPortfolioRetentionMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      arInvoices: [],
      arPayments: [],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.heldCents).toBe(0);
  });
});
