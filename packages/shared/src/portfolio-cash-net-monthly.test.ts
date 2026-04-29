import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { ApPayment } from './ap-payment';
import type { ArPayment } from './ar-payment';
import type { Job } from './job';

import { buildPortfolioCashNetMonthly } from './portfolio-cash-net-monthly';

function job(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '',
    updatedAt: '',
    projectName: 'Test',
    projectType: 'ROAD_RECONSTRUCTION',
    contractType: 'PUBLIC',
    status: 'AWARDED',
    ownerAgency: 'Caltrans D2',
    ...over,
  } as Job;
}

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '',
    updatedAt: '',
    vendorName: 'V',
    invoiceDate: '2026-04-15',
    jobId: 'j1',
    lineItems: [],
    totalCents: 50_000_00,
    paidCents: 0,
    status: 'PENDING',
    ...over,
  } as ApInvoice;
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
    receivedOn: '2026-04-15',
    amountCents: 100_000_00,
    payerName: 'CAL FIRE',
    ...over,
  } as ArPayment;
}

function app(over: Partial<ApPayment>): ApPayment {
  return {
    id: 'app-1',
    createdAt: '',
    updatedAt: '',
    apInvoiceId: 'ap-1',
    vendorName: 'Granite',
    method: 'CHECK',
    paidOn: '2026-04-15',
    amountCents: 30_000_00,
    cleared: false,
    voided: false,
    ...over,
  } as ApPayment;
}

describe('buildPortfolioCashNetMonthly', () => {
  it('computes per-month receipts, payments, net', () => {
    const r = buildPortfolioCashNetMonthly({
      jobs: [job({ id: 'j1' })],
      apInvoices: [ap({ id: 'ap-1', jobId: 'j1' })],
      arPayments: [arp({ jobId: 'j1', amountCents: 100_000_00 })],
      apPayments: [app({ apInvoiceId: 'ap-1', amountCents: 30_000_00 })],
    });
    expect(r.rows[0]?.receiptsCents).toBe(100_000_00);
    expect(r.rows[0]?.paymentsCents).toBe(30_000_00);
    expect(r.rows[0]?.netCents).toBe(70_000_00);
  });

  it('builds running cumulative totals', () => {
    const r = buildPortfolioCashNetMonthly({
      jobs: [job({ id: 'j1' })],
      apInvoices: [],
      arPayments: [
        arp({ id: 'a', receivedOn: '2026-04-15', amountCents: 100_000_00 }),
        arp({ id: 'b', receivedOn: '2026-05-15', amountCents: 50_000_00 }),
      ],
      apPayments: [],
    });
    expect(r.rows[0]?.cumulativeReceiptsCents).toBe(100_000_00);
    expect(r.rows[1]?.cumulativeReceiptsCents).toBe(150_000_00);
    expect(r.rows[1]?.cumulativeNetCents).toBe(150_000_00);
  });

  it('skips voided AP payments', () => {
    const r = buildPortfolioCashNetMonthly({
      jobs: [job({ id: 'j1' })],
      apInvoices: [],
      arPayments: [],
      apPayments: [
        app({ id: 'live', apInvoiceId: 'ap-1' }),
        app({ id: 'gone', voided: true }),
      ],
    });
    expect(r.rollup.voidedSkipped).toBe(1);
    expect(r.rollup.paymentsCents).toBe(30_000_00);
  });

  it('counts distinct receipt customers + payment vendors', () => {
    const r = buildPortfolioCashNetMonthly({
      jobs: [
        job({ id: 'j1', ownerAgency: 'Caltrans D2' }),
        job({ id: 'j2', ownerAgency: 'CAL FIRE' }),
      ],
      apInvoices: [],
      arPayments: [
        arp({ id: 'a', jobId: 'j1' }),
        arp({ id: 'b', jobId: 'j2' }),
      ],
      apPayments: [
        app({ id: 'x', vendorName: 'Granite' }),
        app({ id: 'y', vendorName: 'Bob Trucking' }),
      ],
    });
    expect(r.rows[0]?.distinctReceiptCustomers).toBe(2);
    expect(r.rows[0]?.distinctPaymentVendors).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildPortfolioCashNetMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      jobs: [job({ id: 'j1' })],
      apInvoices: [],
      arPayments: [
        arp({ id: 'old', receivedOn: '2026-03-15' }),
        arp({ id: 'in', receivedOn: '2026-04-15' }),
      ],
      apPayments: [],
    });
    expect(r.rollup.receiptsCents).toBe(100_000_00);
  });

  it('sorts by month asc', () => {
    const r = buildPortfolioCashNetMonthly({
      jobs: [job({ id: 'j1' })],
      apInvoices: [],
      arPayments: [
        arp({ id: 'a', receivedOn: '2026-06-15' }),
        arp({ id: 'b', receivedOn: '2026-04-15' }),
      ],
      apPayments: [],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[1]?.month).toBe('2026-06');
  });

  it('handles empty input', () => {
    const r = buildPortfolioCashNetMonthly({
      jobs: [],
      apInvoices: [],
      arPayments: [],
      apPayments: [],
    });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.netCents).toBe(0);
  });
});
