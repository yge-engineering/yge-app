import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';
import type { Customer } from './customer';

import { buildCustomerRevenueByState } from './customer-revenue-by-state';

function cust(over: Partial<Customer>): Customer {
  return {
    id: 'c-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    legalName: 'CAL FIRE',
    kind: 'GOVERNMENT_AGENCY',
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

describe('buildCustomerRevenueByState', () => {
  it('groups invoices by state via customer join', () => {
    const r = buildCustomerRevenueByState({
      customers: [
        cust({ id: 'c1', legalName: 'CAL FIRE', state: 'CA' }),
        cust({ id: 'c2', legalName: 'NV DOT', state: 'NV' }),
      ],
      arInvoices: [
        inv({ id: 'a', customerName: 'CAL FIRE' }),
        inv({ id: 'b', customerName: 'NV DOT' }),
        inv({ id: 'c', customerName: 'CAL FIRE' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('sums totalCents per state', () => {
    const r = buildCustomerRevenueByState({
      customers: [cust({ id: 'c1', legalName: 'CAL FIRE', state: 'CA' })],
      arInvoices: [
        inv({ id: 'a', totalCents: 30_000_00 }),
        inv({ id: 'b', totalCents: 70_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalCents).toBe(100_000_00);
    expect(r.rows[0]?.invoiceCount).toBe(2);
  });

  it('counts distinct customers + jobs per state', () => {
    const r = buildCustomerRevenueByState({
      customers: [
        cust({ id: 'c1', legalName: 'CAL FIRE', state: 'CA' }),
        cust({ id: 'c2', legalName: 'Caltrans', state: 'CA' }),
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

  it('counts unattributed invoices (no matching customer)', () => {
    const r = buildCustomerRevenueByState({
      customers: [cust({ id: 'c1', legalName: 'CAL FIRE', state: 'CA' })],
      arInvoices: [
        inv({ id: 'a', customerName: 'CAL FIRE' }),
        inv({ id: 'b', customerName: 'Unknown' }),
      ],
    });
    expect(r.rollup.unattributed).toBe(1);
    expect(r.rows).toHaveLength(1);
  });

  it('respects fromDate / toDate', () => {
    const r = buildCustomerRevenueByState({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      customers: [cust({ id: 'c1', legalName: 'CAL FIRE', state: 'CA' })],
      arInvoices: [
        inv({ id: 'old', invoiceDate: '2026-03-15' }),
        inv({ id: 'in', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalInvoices).toBe(1);
  });

  it('sorts by totalCents desc', () => {
    const r = buildCustomerRevenueByState({
      customers: [
        cust({ id: 'c1', legalName: 'CAL FIRE', state: 'CA' }),
        cust({ id: 'c2', legalName: 'NV DOT', state: 'NV' }),
      ],
      arInvoices: [
        inv({ id: 'a', customerName: 'NV DOT', totalCents: 100_000_00 }),
        inv({ id: 'b', customerName: 'CAL FIRE', totalCents: 50_000_00 }),
      ],
    });
    expect(r.rows[0]?.state).toBe('NV');
  });

  it('handles empty input', () => {
    const r = buildCustomerRevenueByState({ customers: [], arInvoices: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalCents).toBe(0);
  });
});
