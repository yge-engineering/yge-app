import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';

import { buildCustomerMonthMatrix } from './customer-month-matrix';

function ar(over: Partial<ArInvoice>): ArInvoice {
  const lineItems = over.lineItems ?? [
    { kind: 'OTHER' as const, description: 'p', quantity: 1, unitPriceCents: 100_000_00, lineTotalCents: 100_000_00 },
  ];
  return {
    id: 'ar-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
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

describe('buildCustomerMonthMatrix', () => {
  it('builds a cell per (customer, month) with billed + count', () => {
    const r = buildCustomerMonthMatrix({
      arInvoices: [
        ar({ id: 'a', createdAt: '2026-03-15T00:00:00.000Z' }),
        ar({ id: 'b', createdAt: '2026-03-25T00:00:00.000Z' }),
        ar({ id: 'c', createdAt: '2026-04-15T00:00:00.000Z' }),
      ],
    });
    const cells = r.rows[0]?.cells ?? [];
    expect(cells).toHaveLength(2);
    const mar = cells.find((c) => c.month === '2026-03');
    expect(mar?.invoiceCount).toBe(2);
  });

  it('groups by canonicalized customer name', () => {
    const r = buildCustomerMonthMatrix({
      arInvoices: [
        ar({ id: 'a', customerName: 'CAL FIRE' }),
        ar({ id: 'b', customerName: 'Cal Fire' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sums lineItems into billedCents per cell', () => {
    const r = buildCustomerMonthMatrix({
      arInvoices: [
        ar({
          id: 'a',
          lineItems: [
            { kind: 'LABOR', description: 'L', quantity: 1, unitPriceCents: 5_000_00, lineTotalCents: 5_000_00 },
            { kind: 'EQUIPMENT', description: 'E', quantity: 1, unitPriceCents: 3_000_00, lineTotalCents: 3_000_00 },
          ],
        }),
      ],
    });
    expect(r.rows[0]?.cells[0]?.billedCents).toBe(8_000_00);
  });

  it('skips DRAFT invoices', () => {
    const r = buildCustomerMonthMatrix({
      arInvoices: [
        ar({ id: 'd', status: 'DRAFT' }),
        ar({ id: 's', status: 'SENT' }),
      ],
    });
    expect(r.rows[0]?.totalInvoices).toBe(1);
  });

  it('respects month bounds', () => {
    const r = buildCustomerMonthMatrix({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      arInvoices: [
        ar({ id: 'mar', createdAt: '2026-03-15T00:00:00.000Z' }),
        ar({ id: 'apr', createdAt: '2026-04-15T00:00:00.000Z' }),
      ],
    });
    expect(r.rows[0]?.cells).toHaveLength(1);
  });

  it('captures lastBilledMonth', () => {
    const r = buildCustomerMonthMatrix({
      arInvoices: [
        ar({ id: 'old', createdAt: '2026-01-15T00:00:00.000Z' }),
        ar({ id: 'new', createdAt: '2026-04-15T00:00:00.000Z' }),
      ],
    });
    expect(r.rows[0]?.lastBilledMonth).toBe('2026-04');
  });

  it('sorts customers by totalBilled desc', () => {
    const r = buildCustomerMonthMatrix({
      arInvoices: [
        ar({ id: 's', customerName: 'Small', lineItems: [
          { kind: 'OTHER', description: 'p', quantity: 1, unitPriceCents: 1_00, lineTotalCents: 1_00 },
        ]}),
        ar({ id: 'b', customerName: 'Big', lineItems: [
          { kind: 'OTHER', description: 'p', quantity: 1, unitPriceCents: 1_000_00, lineTotalCents: 1_000_00 },
        ]}),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('Big');
  });

  it('rolls up portfolio totals + months covered', () => {
    const r = buildCustomerMonthMatrix({
      arInvoices: [
        ar({ id: 'a', customerName: 'A', createdAt: '2026-03-15T00:00:00.000Z' }),
        ar({ id: 'b', customerName: 'B', createdAt: '2026-04-15T00:00:00.000Z' }),
      ],
    });
    expect(r.rollup.monthsCovered).toBe(2);
    expect(r.rollup.totalBilledCents).toBe(200_000_00);
  });

  it('handles empty input', () => {
    const r = buildCustomerMonthMatrix({ arInvoices: [] });
    expect(r.rows).toHaveLength(0);
  });
});
