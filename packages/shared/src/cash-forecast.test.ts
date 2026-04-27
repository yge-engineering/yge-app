import { describe, expect, it } from 'vitest';
import { buildCashForecast } from './cash-forecast';
import type { ApInvoice } from './ap-invoice';
import type { ArInvoice } from './ar-invoice';

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    jobId: 'job-2026-01-01-test-aaaaaaaa',
    invoiceNumber: '1',
    customerName: 'Cal Fire',
    invoiceDate: '2026-04-01',
    source: 'MANUAL',
    lineItems: [],
    subtotalCents: 0,
    totalCents: 50_000_00,
    paidCents: 0,
    status: 'SENT',
    ...over,
  };
}

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'api-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    vendorName: 'Acme Concrete',
    invoiceDate: '2026-04-01',
    totalCents: 10_000_00,
    paidCents: 0,
    status: 'APPROVED',
    lineItems: [],
    ...over,
  } as ApInvoice;
}

const ANCHOR = new Date('2026-04-27T00:00:00Z'); // Monday

describe('buildCashForecast', () => {
  it('produces 12 weeks of buckets by default', () => {
    const r = buildCashForecast({
      arInvoices: [],
      apInvoices: [],
      asOf: ANCHOR,
    });
    expect(r.weeks).toHaveLength(12);
    expect(r.weeks[0]?.weekStart).toBe('2026-04-27');
  });

  it('sums AR balances into the week containing the due date', () => {
    const r = buildCashForecast({
      arInvoices: [ar({ id: 'ar-1', dueDate: '2026-05-15', totalCents: 30_000_00 })],
      apInvoices: [],
      asOf: ANCHOR,
    });
    const targetWeek = r.weeks.find((w) => w.weekStart === '2026-05-11');
    expect(targetWeek?.arInflowCents).toBe(30_000_00);
  });

  it('past-due AR collapses into week 0', () => {
    const r = buildCashForecast({
      arInvoices: [ar({ id: 'ar-1', dueDate: '2026-01-01', totalCents: 10_000_00 })],
      apInvoices: [],
      asOf: ANCHOR,
    });
    expect(r.weeks[0]?.arInflowCents).toBe(10_000_00);
  });

  it('falls back to invoiceDate + 30 days when no dueDate is set', () => {
    const r = buildCashForecast({
      arInvoices: [ar({ id: 'ar-1', invoiceDate: '2026-04-01', dueDate: undefined })],
      apInvoices: [],
      asOf: ANCHOR,
    });
    // Effective due 2026-05-01, in week of 2026-04-27.
    expect(r.weeks[0]?.arInflowCents).toBe(50_000_00);
  });

  it('ignores PAID and WRITTEN_OFF AR', () => {
    const r = buildCashForecast({
      arInvoices: [
        ar({ id: 'ar-1', status: 'PAID' }),
        ar({ id: 'ar-2', status: 'WRITTEN_OFF' }),
      ],
      apInvoices: [],
      asOf: ANCHOR,
    });
    expect(r.totalArInflowCents).toBe(0);
  });

  it('flags first negative week and counts negative weeks', () => {
    const r = buildCashForecast({
      arInvoices: [],
      apInvoices: [
        ap({ id: 'api-1', dueDate: '2026-05-04', totalCents: 50_000_00 }),
      ],
      asOf: ANCHOR,
      startingBalanceCents: 10_000_00,
    });
    expect(r.firstNegativeWeekIndex).toBe(1);
    expect(r.negativeWeekCount).toBeGreaterThanOrEqual(1);
  });

  it('subtracts weekly payroll burn every week', () => {
    const r = buildCashForecast({
      arInvoices: [],
      apInvoices: [],
      weeklyPayrollCents: 5_000_00,
      asOf: ANCHOR,
    });
    expect(r.totalPayrollOutflowCents).toBe(60_000_00); // 12 weeks * $5k
  });
});
