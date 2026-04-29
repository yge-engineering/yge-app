import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';
import type { Customer } from './customer';

import { buildCustomerRevenueByKindMonthly } from './customer-revenue-by-kind-monthly';

function cust(over: Partial<Customer>): Customer {
  return {
    id: 'c-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    legalName: 'CAL FIRE',
    kind: 'STATE_AGENCY',
    state: 'CA',
    ...over,
  } as Customer;
}

function inv(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    jobId: 'j1',
    customerName: 'CAL FIRE',
    invoiceDate: '2026-04-15',
    invoiceNumber: '1',
    lineItems: [],
    subtotalCents: 100_000_00,
    totalCents: 100_000_00,
    paidCents: 0,
    status: 'SENT',
    source: 'MANUAL',
    ...over,
  } as ArInvoice;
}

describe('buildCustomerRevenueByKindMonthly', () => {
  it('groups by (kind, month)', () => {
    const r = buildCustomerRevenueByKindMonthly({
      customers: [
        cust({ id: 'c1', legalName: 'CAL FIRE', kind: 'STATE_AGENCY' }),
        cust({ id: 'c2', legalName: 'Tehama County', kind: 'COUNTY' }),
      ],
      arInvoices: [
        inv({ id: 'a', customerName: 'CAL FIRE', invoiceDate: '2026-04-15' }),
        inv({ id: 'b', customerName: 'CAL FIRE', invoiceDate: '2026-05-01' }),
        inv({ id: 'c', customerName: 'Tehama County', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('sums totalCents per (kind, month)', () => {
    const r = buildCustomerRevenueByKindMonthly({
      customers: [cust({ id: 'c1', legalName: 'CAL FIRE', kind: 'STATE_AGENCY' })],
      arInvoices: [
        inv({ id: 'a', totalCents: 30_000_00 }),
        inv({ id: 'b', totalCents: 70_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalCents).toBe(100_000_00);
    expect(r.rows[0]?.invoiceCount).toBe(2);
  });

  it('counts distinct customers + jobs per (kind, month)', () => {
    const r = buildCustomerRevenueByKindMonthly({
      customers: [
        cust({ id: 'c1', legalName: 'CAL FIRE', kind: 'STATE_AGENCY' }),
        cust({ id: 'c2', legalName: 'Caltrans', kind: 'STATE_AGENCY' }),
      ],
      arInvoices: [
        inv({ id: 'a', customerName: 'CAL FIRE', jobId: 'j1' }),
        inv({ id: 'b', customerName: 'Caltrans', jobId: 'j2' }),
        inv({ id: 'c', customerName: 'CAL FIRE', jobId: 'j1' }),
      ],
    });
    expect(r.rows[0]?.distinctCustomers).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('counts unattributed (no matching customer)', () => {
    const r = buildCustomerRevenueByKindMonthly({
      customers: [cust({ id: 'c1', legalName: 'CAL FIRE', kind: 'STATE_AGENCY' })],
      arInvoices: [
        inv({ id: 'a', customerName: 'CAL FIRE' }),
        inv({ id: 'b', customerName: 'Unknown' }),
      ],
    });
    expect(r.rollup.unattributed).toBe(1);
    expect(r.rows).toHaveLength(1);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildCustomerRevenueByKindMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      customers: [cust({ id: 'c1', legalName: 'CAL FIRE', kind: 'STATE_AGENCY' })],
      arInvoices: [
        inv({ id: 'old', invoiceDate: '2026-03-15' }),
        inv({ id: 'in', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalInvoices).toBe(1);
  });

  it('sorts by month asc, kind asc within month', () => {
    const r = buildCustomerRevenueByKindMonthly({
      customers: [
        cust({ id: 'c1', legalName: 'A', kind: 'STATE_AGENCY' }),
        cust({ id: 'c2', legalName: 'B', kind: 'COUNTY' }),
      ],
      arInvoices: [
        inv({ id: 'a', customerName: 'A', invoiceDate: '2026-05-15' }),
        inv({ id: 'b', customerName: 'B', invoiceDate: '2026-04-15' }),
        inv({ id: 'c', customerName: 'A', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[0]?.kind).toBe('COUNTY');
    expect(r.rows[2]?.month).toBe('2026-05');
  });

  it('handles empty input', () => {
    const r = buildCustomerRevenueByKindMonthly({ customers: [], arInvoices: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalCents).toBe(0);
  });
});
