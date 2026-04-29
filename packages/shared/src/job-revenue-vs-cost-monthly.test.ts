import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { ArInvoice } from './ar-invoice';
import type { Expense } from './expense';

import { buildJobRevenueVsCostMonthly } from './job-revenue-vs-cost-monthly';

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    jobId: 'j1',
    customerName: 'CAL FIRE',
    invoiceDate: '2026-04-15',
    invoiceNumber: '1',
    lineItems: [],
    subtotalCents: 0,
    totalCents: 100_000_00,
    paidCents: 0,
    status: 'SENT',
    source: 'MANUAL',
    ...over,
  } as ArInvoice;
}

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    vendorName: 'Granite',
    invoiceDate: '2026-04-15',
    jobId: 'j1',
    lineItems: [],
    totalCents: 30_000_00,
    paidCents: 0,
    status: 'PENDING',
    ...over,
  } as ApInvoice;
}

function exp(over: Partial<Expense>): Expense {
  return {
    id: 'ex-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    employeeName: 'Pat',
    receiptDate: '2026-04-15',
    amountCents: 5_000_00,
    category: 'FUEL',
    description: 'Test',
    reimbursed: false,
    jobId: 'j1',
    ...over,
  } as Expense;
}

describe('buildJobRevenueVsCostMonthly', () => {
  it('computes margin from AR + AP + expense buckets', () => {
    const r = buildJobRevenueVsCostMonthly({
      arInvoices: [ar({ totalCents: 100_000_00 })],
      apInvoices: [ap({ totalCents: 30_000_00 })],
      expenses: [exp({ amountCents: 5_000_00 })],
    });
    expect(r.rows[0]?.billedCents).toBe(100_000_00);
    expect(r.rows[0]?.costCents).toBe(35_000_00);
    expect(r.rows[0]?.marginCents).toBe(65_000_00);
    expect(r.rows[0]?.marginPct).toBe(0.65);
  });

  it('returns null marginPct when billed=0', () => {
    const r = buildJobRevenueVsCostMonthly({
      arInvoices: [],
      apInvoices: [ap({ totalCents: 10_000_00 })],
      expenses: [],
    });
    expect(r.rows[0]?.marginPct).toBeNull();
  });

  it('counts unattributed AP/expense (no jobId)', () => {
    const r = buildJobRevenueVsCostMonthly({
      arInvoices: [],
      apInvoices: [ap({ jobId: undefined })],
      expenses: [exp({ jobId: undefined })],
    });
    expect(r.rollup.unattributed).toBe(2);
  });

  it('groups across (job, month)', () => {
    const r = buildJobRevenueVsCostMonthly({
      arInvoices: [
        ar({ id: 'a', jobId: 'j1', invoiceDate: '2026-04-15' }),
        ar({ id: 'b', jobId: 'j1', invoiceDate: '2026-05-01' }),
        ar({ id: 'c', jobId: 'j2', invoiceDate: '2026-04-15' }),
      ],
      apInvoices: [],
      expenses: [],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildJobRevenueVsCostMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      arInvoices: [
        ar({ id: 'old', invoiceDate: '2026-03-15' }),
        ar({ id: 'in', invoiceDate: '2026-04-15' }),
      ],
      apInvoices: [],
      expenses: [],
    });
    expect(r.rollup.billedCents).toBe(100_000_00);
  });

  it('rolls up portfolio totals', () => {
    const r = buildJobRevenueVsCostMonthly({
      arInvoices: [ar({ totalCents: 100_000_00 })],
      apInvoices: [ap({ totalCents: 30_000_00 })],
      expenses: [exp({ amountCents: 5_000_00 })],
    });
    expect(r.rollup.billedCents).toBe(100_000_00);
    expect(r.rollup.costCents).toBe(35_000_00);
    expect(r.rollup.marginCents).toBe(65_000_00);
  });

  it('sorts by jobId asc, month asc', () => {
    const r = buildJobRevenueVsCostMonthly({
      arInvoices: [
        ar({ id: 'a', jobId: 'Z', invoiceDate: '2026-04-15' }),
        ar({ id: 'b', jobId: 'A', invoiceDate: '2026-05-01' }),
        ar({ id: 'c', jobId: 'A', invoiceDate: '2026-04-15' }),
      ],
      apInvoices: [],
      expenses: [],
    });
    expect(r.rows[0]?.jobId).toBe('A');
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[2]?.jobId).toBe('Z');
  });

  it('handles empty input', () => {
    const r = buildJobRevenueVsCostMonthly({ arInvoices: [], apInvoices: [], expenses: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.marginCents).toBe(0);
  });
});
