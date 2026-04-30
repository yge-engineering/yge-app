import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { ApPayment } from './ap-payment';

import { buildPortfolioApAgingYoy } from './portfolio-ap-aging-yoy';

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '',
    updatedAt: '',
    vendorName: 'V',
    invoiceDate: '2026-12-15',
    jobId: 'j1',
    lineItems: [],
    totalCents: 100_000_00,
    paidCents: 0,
    status: 'PENDING',
    ...over,
  } as ApInvoice;
}

function app(over: Partial<ApPayment>): ApPayment {
  return {
    id: 'app-1',
    createdAt: '',
    updatedAt: '',
    apInvoiceId: 'ap-1',
    vendorName: 'V',
    method: 'CHECK',
    paidOn: '2026-12-25',
    amountCents: 30_000_00,
    cleared: false,
    voided: false,
    ...over,
  } as ApPayment;
}

describe('buildPortfolioApAgingYoy', () => {
  it('snapshots prior + current year-end open AP', () => {
    const r = buildPortfolioApAgingYoy({
      currentYear: 2026,
      apInvoices: [
        ap({ id: 'a', invoiceDate: '2025-12-15', totalCents: 50_000_00 }),
        ap({ id: 'b', invoiceDate: '2026-12-15', totalCents: 100_000_00 }),
      ],
      apPayments: [],
    });
    expect(r.prior.openCents).toBe(50_000_00);
    expect(r.current.openCents).toBe(150_000_00);
    expect(r.openCentsDelta).toBe(100_000_00);
  });

  it('subtracts non-voided payments + ignores voided', () => {
    const r = buildPortfolioApAgingYoy({
      currentYear: 2026,
      apInvoices: [ap({ id: 'a', totalCents: 100_000_00 })],
      apPayments: [
        app({ id: 'live', apInvoiceId: 'a', amountCents: 30_000_00 }),
        app({ id: 'gone', apInvoiceId: 'a', amountCents: 50_000_00, voided: true }),
      ],
    });
    expect(r.current.openCents).toBe(70_000_00);
  });

  it('buckets ages on the snapshot date', () => {
    const r = buildPortfolioApAgingYoy({
      currentYear: 2026,
      apInvoices: [
        ap({ id: 'a', invoiceDate: '2026-12-15' }),
        ap({ id: 'b', invoiceDate: '2026-11-15' }),
        ap({ id: 'c', invoiceDate: '2026-10-15' }),
        ap({ id: 'd', invoiceDate: '2026-08-15' }),
      ],
      apPayments: [],
    });
    expect(r.current.days1to30Cents).toBe(100_000_00);
    expect(r.current.days31to60Cents).toBe(100_000_00);
    expect(r.current.days61to90Cents).toBe(100_000_00);
    expect(r.current.days90PlusCents).toBe(100_000_00);
  });

  it('handles empty input', () => {
    const r = buildPortfolioApAgingYoy({
      currentYear: 2026,
      apInvoices: [],
      apPayments: [],
    });
    expect(r.current.openCents).toBe(0);
  });
});
