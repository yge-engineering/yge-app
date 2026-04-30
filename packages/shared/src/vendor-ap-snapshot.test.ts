import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { ApPayment } from './ap-payment';

import { buildVendorApSnapshot } from './vendor-ap-snapshot';

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '',
    updatedAt: '',
    vendorName: 'Granite Construction Co.',
    invoiceDate: '2026-04-15',
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
    vendorName: 'Granite',
    method: 'CHECK',
    paidOn: '2026-04-25',
    amountCents: 30_000_00,
    cleared: false,
    voided: false,
    ...over,
  } as ApPayment;
}

describe('buildVendorApSnapshot', () => {
  it('matches vendor names ignoring LLC/Inc/Co', () => {
    const r = buildVendorApSnapshot({
      vendorName: 'Granite Construction',
      asOf: '2026-04-30',
      apInvoices: [
        ap({ id: 'a', vendorName: 'Granite Construction Co.', totalCents: 100_000_00 }),
        ap({ id: 'b', vendorName: 'GRANITE CONSTRUCTION INC', totalCents: 50_000_00 }),
        ap({ id: 'c', vendorName: 'Olson Iron LLC', totalCents: 25_000_00 }),
      ],
      apPayments: [],
    });
    expect(r.invoiceCount).toBe(2);
    expect(r.totalCents).toBe(150_000_00);
  });

  it('sums billed/paid/open + skips voided', () => {
    const r = buildVendorApSnapshot({
      vendorName: 'Granite',
      asOf: '2026-04-30',
      apInvoices: [ap({ id: 'a', vendorName: 'Granite', totalCents: 100_000_00 })],
      apPayments: [
        app({ id: 'live', apInvoiceId: 'a', amountCents: 30_000_00 }),
        app({ id: 'gone', apInvoiceId: 'a', amountCents: 50_000_00, voided: true }),
      ],
    });
    expect(r.paidCents).toBe(30_000_00);
    expect(r.openCents).toBe(70_000_00);
  });

  it('buckets open by age', () => {
    const r = buildVendorApSnapshot({
      vendorName: 'Granite',
      asOf: '2026-06-30',
      apInvoices: [
        ap({ id: 'a', vendorName: 'Granite', invoiceDate: '2026-06-25' }),
        ap({ id: 'b', vendorName: 'Granite', invoiceDate: '2026-05-25' }),
        ap({ id: 'c', vendorName: 'Granite', invoiceDate: '2026-04-25' }),
        ap({ id: 'd', vendorName: 'Granite', invoiceDate: '2026-02-25' }),
      ],
      apPayments: [],
    });
    expect(r.openInvoiceCount).toBe(4);
    expect(r.days1to30Cents).toBe(100_000_00);
    expect(r.days31to60Cents).toBe(100_000_00);
    expect(r.days61to90Cents).toBe(100_000_00);
    expect(r.days90PlusCents).toBe(100_000_00);
  });

  it('handles unknown vendor', () => {
    const r = buildVendorApSnapshot({
      vendorName: 'NonExistent',
      apInvoices: [],
      apPayments: [],
    });
    expect(r.totalCents).toBe(0);
  });
});
