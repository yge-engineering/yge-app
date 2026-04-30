import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';

import { buildPortfolioArAgingYoy } from './portfolio-ar-aging-yoy';

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    customerName: 'X',
    invoiceDate: '2026-12-15',
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

describe('buildPortfolioArAgingYoy', () => {
  it('snapshots prior + current year-end open AR', () => {
    const r = buildPortfolioArAgingYoy({
      currentYear: 2026,
      arInvoices: [
        ar({ id: 'a', invoiceDate: '2025-12-15', totalCents: 50_000_00 }),
        ar({ id: 'b', invoiceDate: '2026-12-15', totalCents: 100_000_00 }),
      ],
      arPayments: [],
    });
    expect(r.prior.openCents).toBe(50_000_00);
    expect(r.current.openCents).toBe(150_000_00);
    expect(r.openCentsDelta).toBe(100_000_00);
  });

  it('subtracts payments received on/before snapshot date', () => {
    const r = buildPortfolioArAgingYoy({
      currentYear: 2026,
      arInvoices: [ar({ id: 'a', invoiceDate: '2026-12-15', totalCents: 100_000_00 })],
      arPayments: [
        {
          id: 'p1',
          createdAt: '',
          updatedAt: '',
          arInvoiceId: 'a',
          jobId: 'j1',
          kind: 'PROGRESS',
          method: 'CHECK',
          receivedOn: '2026-12-25',
          amountCents: 30_000_00,
          payerName: 'X',
        } as ArPayment,
      ],
    });
    expect(r.current.openCents).toBe(70_000_00);
  });

  it('buckets ages on the snapshot date', () => {
    const r = buildPortfolioArAgingYoy({
      currentYear: 2026,
      arInvoices: [
        ar({ id: 'a', invoiceDate: '2026-12-15' }), // ~16 days
        ar({ id: 'b', invoiceDate: '2026-11-15' }), // ~46 days
        ar({ id: 'c', invoiceDate: '2026-10-15' }), // ~77 days
        ar({ id: 'd', invoiceDate: '2026-08-15' }), // ~138 days
      ],
      arPayments: [],
    });
    expect(r.current.days1to30Cents).toBe(100_000_00);
    expect(r.current.days31to60Cents).toBe(100_000_00);
    expect(r.current.days61to90Cents).toBe(100_000_00);
    expect(r.current.days90PlusCents).toBe(100_000_00);
  });

  it('handles empty input', () => {
    const r = buildPortfolioArAgingYoy({
      currentYear: 2026,
      arInvoices: [],
      arPayments: [],
    });
    expect(r.current.openCents).toBe(0);
  });
});
