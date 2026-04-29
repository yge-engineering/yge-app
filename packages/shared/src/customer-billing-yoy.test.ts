import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';

import { buildCustomerBillingYoy } from './customer-billing-yoy';

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

describe('buildCustomerBillingYoy', () => {
  it('groups by year', () => {
    const r = buildCustomerBillingYoy({
      arInvoices: [
        ar({ id: 'a', invoiceDate: '2025-04-15' }),
        ar({ id: 'b', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('computes YoY change', () => {
    const r = buildCustomerBillingYoy({
      arInvoices: [
        ar({ id: 'a', invoiceDate: '2025-04-15', totalCents: 50_000_00 }),
        ar({ id: 'b', invoiceDate: '2026-04-15', totalCents: 100_000_00 }),
      ],
    });
    const cur = r.rows.find((x) => x.year === 2026);
    expect(cur?.yoyChangeCents).toBe(50_000_00);
    expect(cur?.yoyChangePct).toBe(1);
  });

  it('counts distinct customers and jobs', () => {
    const r = buildCustomerBillingYoy({
      arInvoices: [
        ar({ id: 'a', customerName: 'A', jobId: 'j1' }),
        ar({ id: 'b', customerName: 'B', jobId: 'j2' }),
      ],
    });
    expect(r.rows[0]?.distinctCustomers).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('respects fromYear / toYear', () => {
    const r = buildCustomerBillingYoy({
      fromYear: 2026,
      toYear: 2026,
      arInvoices: [
        ar({ id: 'old', invoiceDate: '2025-04-15' }),
        ar({ id: 'in', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sorts by year asc', () => {
    const r = buildCustomerBillingYoy({
      arInvoices: [
        ar({ id: 'a', invoiceDate: '2026-04-15' }),
        ar({ id: 'b', invoiceDate: '2024-04-15' }),
      ],
    });
    expect(r.rows[0]?.year).toBe(2024);
  });

  it('handles empty input', () => {
    const r = buildCustomerBillingYoy({ arInvoices: [] });
    expect(r.rows).toHaveLength(0);
  });
});
