import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';

import { buildCustomerArAging } from './customer-ar-aging';

function ar(over: Partial<ArInvoice>): ArInvoice {
  const lineItems = over.lineItems ?? [
    {
      kind: 'OTHER' as const,
      description: 'Progress',
      quantity: 1,
      unitPriceCents: 100_000_00,
      lineTotalCents: 100_000_00,
    },
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

describe('buildCustomerArAging', () => {
  it('buckets outstanding into 0-30 / 31-60 / 61-90 / 90+', () => {
    const r = buildCustomerArAging({
      asOf: '2026-04-30',
      arInvoices: [
        ar({ id: 'a', createdAt: '2026-04-15T00:00:00.000Z' }),  // 15 days
        ar({ id: 'b', createdAt: '2026-03-15T00:00:00.000Z' }),  // 46 days
        ar({ id: 'c', createdAt: '2026-02-01T00:00:00.000Z' }),  // 88 days
        ar({ id: 'd', createdAt: '2025-12-01T00:00:00.000Z' }),  // 150 days
      ],
    });
    const row = r.rows[0];
    expect(row?.bucket0to30Cents).toBe(100_000_00);
    expect(row?.bucket31to60Cents).toBe(100_000_00);
    expect(row?.bucket61to90Cents).toBe(100_000_00);
    expect(row?.bucket90PlusCents).toBe(100_000_00);
  });

  it('sums outstanding = lineItems total - paidCents', () => {
    const r = buildCustomerArAging({
      asOf: '2026-04-30',
      arInvoices: [
        ar({ id: 'a', createdAt: '2026-04-15T00:00:00.000Z', paidCents: 30_000_00 }),
      ],
    });
    expect(r.rows[0]?.bucket0to30Cents).toBe(70_000_00);
  });

  it('skips fully paid invoices', () => {
    const r = buildCustomerArAging({
      asOf: '2026-04-30',
      arInvoices: [
        ar({ id: 'paid', paidCents: 100_000_00 }),
        ar({ id: 'open', paidCents: 0 }),
      ],
    });
    expect(r.rows[0]?.openInvoiceCount).toBe(1);
  });

  it('skips DRAFT and WRITTEN_OFF invoices', () => {
    const r = buildCustomerArAging({
      asOf: '2026-04-30',
      arInvoices: [
        ar({ id: 'd', status: 'DRAFT' }),
        ar({ id: 'w', status: 'WRITTEN_OFF' }),
        ar({ id: 'o', status: 'SENT' }),
      ],
    });
    expect(r.rows[0]?.openInvoiceCount).toBe(1);
  });

  it('groups by canonicalized customer name', () => {
    const r = buildCustomerArAging({
      asOf: '2026-04-30',
      arInvoices: [
        ar({ id: 'a', customerName: 'CAL FIRE' }),
        ar({ id: 'b', customerName: 'Cal Fire' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.openInvoiceCount).toBe(2);
  });

  it('captures oldest open age', () => {
    const r = buildCustomerArAging({
      asOf: '2026-04-30',
      arInvoices: [
        ar({ id: 'old', createdAt: '2026-01-01T00:00:00.000Z' }),
        ar({ id: 'new', createdAt: '2026-04-15T00:00:00.000Z' }),
      ],
    });
    expect(r.rows[0]?.oldestOpenAgeDays).toBe(119);
  });

  it('sorts most 90+ first', () => {
    const r = buildCustomerArAging({
      asOf: '2026-04-30',
      arInvoices: [
        ar({ id: 'fresh', customerName: 'Fresh', createdAt: '2026-04-15T00:00:00.000Z' }),
        ar({ id: 'stale', customerName: 'Stale', createdAt: '2025-12-01T00:00:00.000Z' }),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('Stale');
  });

  it('rolls up portfolio bucket totals', () => {
    const r = buildCustomerArAging({
      asOf: '2026-04-30',
      arInvoices: [
        ar({ id: 'a', customerName: 'A', createdAt: '2026-04-15T00:00:00.000Z' }),
        ar({ id: 'b', customerName: 'B', createdAt: '2025-12-01T00:00:00.000Z' }),
      ],
    });
    expect(r.rollup.total0to30).toBe(100_000_00);
    expect(r.rollup.total90Plus).toBe(100_000_00);
    expect(r.rollup.totalOutstanding).toBe(200_000_00);
  });

  it('handles empty input', () => {
    const r = buildCustomerArAging({ arInvoices: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalOutstanding).toBe(0);
  });
});
