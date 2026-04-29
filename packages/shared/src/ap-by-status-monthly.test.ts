import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';

import { buildApByStatusMonthly } from './ap-by-status-monthly';

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    vendorName: 'Granite',
    invoiceDate: '2026-04-15',
    lineItems: [],
    totalCents: 50_000_00,
    paidCents: 0,
    status: 'PENDING',
    ...over,
  } as ApInvoice;
}

describe('buildApByStatusMonthly', () => {
  it('groups by (status, month)', () => {
    const r = buildApByStatusMonthly({
      apInvoices: [
        ap({ id: 'a', status: 'PENDING', invoiceDate: '2026-03-15' }),
        ap({ id: 'b', status: 'PENDING', invoiceDate: '2026-04-15' }),
        ap({ id: 'c', status: 'PAID', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('sums count and cents', () => {
    const r = buildApByStatusMonthly({
      apInvoices: [
        ap({ id: 'a', totalCents: 30_000_00 }),
        ap({ id: 'b', totalCents: 20_000_00 }),
      ],
    });
    expect(r.rows[0]?.count).toBe(2);
    expect(r.rows[0]?.totalAmountCents).toBe(50_000_00);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildApByStatusMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      apInvoices: [
        ap({ id: 'mar', invoiceDate: '2026-03-15' }),
        ap({ id: 'apr', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalInvoices).toBe(1);
  });

  it('sorts by status asc, month asc', () => {
    const r = buildApByStatusMonthly({
      apInvoices: [
        ap({ id: 'a', status: 'PENDING', invoiceDate: '2026-04-15' }),
        ap({ id: 'b', status: 'APPROVED', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.status).toBe('APPROVED');
  });

  it('rolls up totals', () => {
    const r = buildApByStatusMonthly({
      apInvoices: [ap({ totalCents: 10_000_00 }), ap({ id: 'b', totalCents: 20_000_00 })],
    });
    expect(r.rollup.totalAmountCents).toBe(30_000_00);
  });

  it('handles empty input', () => {
    const r = buildApByStatusMonthly({ apInvoices: [] });
    expect(r.rows).toHaveLength(0);
  });
});
