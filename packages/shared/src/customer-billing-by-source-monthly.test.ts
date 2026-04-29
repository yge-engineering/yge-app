import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';

import { buildCustomerBillingBySourceMonthly } from './customer-billing-by-source-monthly';

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'j1',
    invoiceNumber: '1',
    customerName: 'CAL FIRE',
    invoiceDate: '2026-04-15',
    source: 'PROGRESS',
    lineItems: [],
    totalCents: 100_000_00,
    paidCents: 0,
    status: 'SENT',
    ...over,
  } as ArInvoice;
}

describe('buildCustomerBillingBySourceMonthly', () => {
  it('groups by (customer, source, month)', () => {
    const r = buildCustomerBillingBySourceMonthly({
      arInvoices: [
        ar({ id: 'a', customerName: 'A', source: 'PROGRESS', invoiceDate: '2026-04-15' }),
        ar({ id: 'b', customerName: 'A', source: 'MANUAL', invoiceDate: '2026-04-15' }),
        ar({ id: 'c', customerName: 'A', source: 'PROGRESS', invoiceDate: '2026-03-15' }),
        ar({ id: 'd', customerName: 'B', source: 'PROGRESS', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(4);
  });

  it('sums cents and counts distinct jobs', () => {
    const r = buildCustomerBillingBySourceMonthly({
      arInvoices: [
        ar({ id: 'a', jobId: 'j1', totalCents: 30_000_00 }),
        ar({ id: 'b', jobId: 'j2', totalCents: 70_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalCents).toBe(100_000_00);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('canonicalizes customer name', () => {
    const r = buildCustomerBillingBySourceMonthly({
      arInvoices: [
        ar({ id: 'a', customerName: 'CAL FIRE' }),
        ar({ id: 'b', customerName: 'Cal Fire, Inc.' }),
      ],
    });
    expect(r.rollup.customersConsidered).toBe(1);
  });

  it('respects fromMonth / toMonth bounds', () => {
    const r = buildCustomerBillingBySourceMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      arInvoices: [
        ar({ id: 'mar', invoiceDate: '2026-03-15' }),
        ar({ id: 'apr', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sorts by customer asc, source asc, month asc', () => {
    const r = buildCustomerBillingBySourceMonthly({
      arInvoices: [
        ar({ id: 'a', customerName: 'A', source: 'PROGRESS', invoiceDate: '2026-04-15' }),
        ar({ id: 'b', customerName: 'A', source: 'MANUAL', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.source).toBe('MANUAL');
  });

  it('handles empty input', () => {
    const r = buildCustomerBillingBySourceMonthly({ arInvoices: [] });
    expect(r.rows).toHaveLength(0);
  });
});
