import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { ApPayment } from './ap-payment';
import type { ArPayment } from './ar-payment';
import type { Job } from './job';

import { buildCustomerCashNetMonthly } from './customer-cash-net-monthly';

function job(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
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
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
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

function app(over: Partial<ApPayment>): ApPayment {
  return {
    id: 'app-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    apInvoiceId: 'ap-1',
    vendorName: 'V',
    method: 'CHECK',
    paidOn: '2026-04-15',
    amountCents: 30_000_00,
    cleared: false,
    voided: false,
    ...over,
  } as ApPayment;
}

describe('buildCustomerCashNetMonthly', () => {
  it('computes receipts, payments, net per (customer, month)', () => {
    const r = buildCustomerCashNetMonthly({
      jobs: [job({ id: 'j1', ownerAgency: 'Caltrans D2' })],
      apInvoices: [ap({ id: 'ap-1', jobId: 'j1' })],
      arPayments: [arp({ jobId: 'j1', amountCents: 100_000_00 })],
      apPayments: [app({ apInvoiceId: 'ap-1', amountCents: 30_000_00 })],
    });
    expect(r.rows[0]?.receiptsCents).toBe(100_000_00);
    expect(r.rows[0]?.paymentsCents).toBe(30_000_00);
    expect(r.rows[0]?.netCents).toBe(70_000_00);
  });

  it('skips voided AP payments', () => {
    const r = buildCustomerCashNetMonthly({
      jobs: [job({ id: 'j1' })],
      apInvoices: [ap({ id: 'ap-1', jobId: 'j1' })],
      arPayments: [],
      apPayments: [app({ voided: true })],
    });
    expect(r.rollup.voidedSkipped).toBe(1);
  });

  it('counts unattributed (no jobId or no matching customer)', () => {
    const r = buildCustomerCashNetMonthly({
      jobs: [job({ id: 'j1' })],
      apInvoices: [],
      arPayments: [arp({ jobId: undefined })],
      apPayments: [app({ apInvoiceId: 'orphan' })],
    });
    expect(r.rollup.unattributed).toBeGreaterThanOrEqual(1);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildCustomerCashNetMonthly({
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

  it('groups by (customer, month)', () => {
    const r = buildCustomerCashNetMonthly({
      jobs: [
        job({ id: 'j1', ownerAgency: 'Caltrans D2' }),
        job({ id: 'j2', ownerAgency: 'CAL FIRE' }),
      ],
      apInvoices: [],
      arPayments: [
        arp({ id: 'a', jobId: 'j1', receivedOn: '2026-04-15' }),
        arp({ id: 'b', jobId: 'j2', receivedOn: '2026-04-15' }),
        arp({ id: 'c', jobId: 'j1', receivedOn: '2026-05-01' }),
      ],
      apPayments: [],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('sorts by customerName asc, month asc', () => {
    const r = buildCustomerCashNetMonthly({
      jobs: [
        job({ id: 'jA', ownerAgency: 'A Agency' }),
        job({ id: 'jZ', ownerAgency: 'Z Agency' }),
      ],
      apInvoices: [],
      arPayments: [
        arp({ id: 'a', jobId: 'jZ', receivedOn: '2026-04-15' }),
        arp({ id: 'b', jobId: 'jA', receivedOn: '2026-05-01' }),
        arp({ id: 'c', jobId: 'jA', receivedOn: '2026-04-15' }),
      ],
      apPayments: [],
    });
    expect(r.rows[0]?.customerName).toBe('A Agency');
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[2]?.customerName).toBe('Z Agency');
  });

  it('handles empty input', () => {
    const r = buildCustomerCashNetMonthly({
      jobs: [],
      apInvoices: [],
      arPayments: [],
      apPayments: [],
    });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.netCents).toBe(0);
  });
});
