import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';

import { buildCustomerLifetime } from './customer-lifetime';

function ar(over: Partial<ArInvoice>): ArInvoice {
  const lineItems = over.lineItems ?? [
    { kind: 'OTHER' as const, description: 'p', quantity: 1, unitPriceCents: 100_000_00, lineTotalCents: 100_000_00 },
  ];
  return {
    id: 'ar-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'j1',
    invoiceNumber: '1',
    customerName: 'CAL FIRE',
    source: 'PROGRESS',
    lineItems,
    paidCents: 0,
    status: 'SENT',
    ...over,
  } as ArInvoice;
}

describe('buildCustomerLifetime', () => {
  it('groups by canonicalized customer name', () => {
    const r = buildCustomerLifetime({
      arInvoices: [
        ar({ id: 'a', customerName: 'CAL FIRE' }),
        ar({ id: 'b', customerName: 'Cal Fire' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.invoiceCount).toBe(2);
  });

  it('sums billed + paid + outstanding', () => {
    const r = buildCustomerLifetime({
      arInvoices: [
        ar({ id: 'a', paidCents: 30_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalBilledCents).toBe(100_000_00);
    expect(r.rows[0]?.totalPaidCents).toBe(30_000_00);
    expect(r.rows[0]?.outstandingCents).toBe(70_000_00);
  });

  it('counts distinct jobs', () => {
    const r = buildCustomerLifetime({
      arInvoices: [
        ar({ id: 'a', jobId: 'j1' }),
        ar({ id: 'b', jobId: 'j2' }),
        ar({ id: 'c', jobId: 'j1' }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('captures first / last invoice date + lifetime span', () => {
    const r = buildCustomerLifetime({
      arInvoices: [
        ar({ id: 'old', createdAt: '2025-01-15T00:00:00.000Z' }),
        ar({ id: 'new', createdAt: '2026-04-15T00:00:00.000Z' }),
      ],
    });
    expect(r.rows[0]?.firstInvoiceDate).toBe('2025-01-15');
    expect(r.rows[0]?.lastInvoiceDate).toBe('2026-04-15');
    expect(r.rows[0]?.lifetimeSpanDays).toBe(455);
  });

  it('skips DRAFT invoices', () => {
    const r = buildCustomerLifetime({
      arInvoices: [
        ar({ id: 'd', status: 'DRAFT' }),
        ar({ id: 's', status: 'SENT' }),
      ],
    });
    expect(r.rollup.customersConsidered).toBe(1);
  });

  it('sorts customers by billed desc', () => {
    const r = buildCustomerLifetime({
      arInvoices: [
        ar({ id: 'small', customerName: 'Small Customer', lineItems: [
          { kind: 'OTHER', description: 'p', quantity: 1, unitPriceCents: 1_000_00, lineTotalCents: 1_000_00 },
        ]}),
        ar({ id: 'big', customerName: 'Big Customer', lineItems: [
          { kind: 'OTHER', description: 'p', quantity: 1, unitPriceCents: 500_000_00, lineTotalCents: 500_000_00 },
        ]}),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('Big Customer');
  });

  it('rolls up portfolio totals', () => {
    const r = buildCustomerLifetime({
      arInvoices: [
        ar({ id: 'a', paidCents: 50_000_00 }),
        ar({ id: 'b', customerName: 'Caltrans', paidCents: 70_000_00 }),
      ],
    });
    expect(r.rollup.totalBilledCents).toBe(200_000_00);
    expect(r.rollup.totalPaidCents).toBe(120_000_00);
    expect(r.rollup.totalOutstandingCents).toBe(80_000_00);
  });

  it('handles empty input', () => {
    const r = buildCustomerLifetime({ arInvoices: [] });
    expect(r.rows).toHaveLength(0);
  });
});
