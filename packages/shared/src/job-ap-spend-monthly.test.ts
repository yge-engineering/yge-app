import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';

import { buildJobApSpendMonthly } from './job-ap-spend-monthly';

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    vendorName: 'Granite',
    invoiceDate: '2026-04-15',
    jobId: 'j1',
    lineItems: [],
    totalCents: 50_000_00,
    paidCents: 0,
    status: 'PENDING',
    ...over,
  } as ApInvoice;
}

describe('buildJobApSpendMonthly', () => {
  it('groups by (job, month)', () => {
    const r = buildJobApSpendMonthly({
      apInvoices: [
        ap({ id: 'a', jobId: 'j1', invoiceDate: '2026-04-15' }),
        ap({ id: 'b', jobId: 'j1', invoiceDate: '2026-05-01' }),
        ap({ id: 'c', jobId: 'j2', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('sums totalCents and paidCents per (job, month)', () => {
    const r = buildJobApSpendMonthly({
      apInvoices: [
        ap({ id: 'a', totalCents: 100_000_00, paidCents: 30_000_00 }),
        ap({ id: 'b', totalCents: 50_000_00, paidCents: 50_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalCents).toBe(150_000_00);
    expect(r.rows[0]?.paidCents).toBe(80_000_00);
    expect(r.rows[0]?.openCents).toBe(70_000_00);
  });

  it('counts distinct vendors per (job, month)', () => {
    const r = buildJobApSpendMonthly({
      apInvoices: [
        ap({ id: 'a', vendorName: 'Granite' }),
        ap({ id: 'b', vendorName: 'Granite, Inc' }),
        ap({ id: 'c', vendorName: 'Bob Trucking' }),
      ],
    });
    expect(r.rows[0]?.distinctVendors).toBe(2);
  });

  it('counts unattributed (no jobId)', () => {
    const r = buildJobApSpendMonthly({
      apInvoices: [
        ap({ id: 'a', jobId: 'j1' }),
        ap({ id: 'b', jobId: undefined }),
      ],
    });
    expect(r.rollup.unattributed).toBe(1);
    expect(r.rows).toHaveLength(1);
  });

  it('respects fromMonth / toMonth window', () => {
    const r = buildJobApSpendMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      apInvoices: [
        ap({ id: 'old', invoiceDate: '2026-03-15' }),
        ap({ id: 'in', invoiceDate: '2026-04-15' }),
        ap({ id: 'late', invoiceDate: '2026-05-01' }),
      ],
    });
    expect(r.rollup.totalInvoices).toBe(1);
  });

  it('rolls up portfolio totals', () => {
    const r = buildJobApSpendMonthly({
      apInvoices: [
        ap({ id: 'a', jobId: 'j1', totalCents: 100_000_00, paidCents: 25_000_00 }),
        ap({ id: 'b', jobId: 'j2', totalCents: 50_000_00, paidCents: 50_000_00 }),
      ],
    });
    expect(r.rollup.totalCents).toBe(150_000_00);
    expect(r.rollup.paidCents).toBe(75_000_00);
    expect(r.rollup.openCents).toBe(75_000_00);
  });

  it('sorts by jobId asc, month asc', () => {
    const r = buildJobApSpendMonthly({
      apInvoices: [
        ap({ id: 'a', jobId: 'Z', invoiceDate: '2026-04-15' }),
        ap({ id: 'b', jobId: 'A', invoiceDate: '2026-05-01' }),
        ap({ id: 'c', jobId: 'A', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('A');
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[2]?.jobId).toBe('Z');
  });

  it('handles empty input', () => {
    const r = buildJobApSpendMonthly({ apInvoices: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalCents).toBe(0);
  });
});
