import { describe, expect, it } from 'vitest';
import { buildCustomerConcentration } from './customer-concentration';
import type { ArInvoice } from './ar-invoice';

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'job-1',
    invoiceNumber: '1',
    customerName: 'Cal Fire',
    invoiceDate: '2026-04-15',
    source: 'MANUAL',
    lineItems: [],
    subtotalCents: 100_00,
    totalCents: 100_00,
    paidCents: 0,
    status: 'SENT',
    ...over,
  } as ArInvoice;
}

describe('buildCustomerConcentration', () => {
  it('rolls billing up by customer + sorts highest first', () => {
    const r = buildCustomerConcentration({
      start: '2026-04-01',
      end: '2026-04-30',
      arInvoices: [
        ar({ id: '1', customerName: 'Cal Fire', totalCents: 100_000_00 }),
        ar({ id: '2', customerName: 'Caltrans', totalCents: 200_000_00 }),
        ar({ id: '3', customerName: 'Cal Fire', totalCents: 50_000_00 }),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('Caltrans');
    expect(r.rows[0]?.billedCents).toBe(200_000_00);
    expect(r.rows[1]?.customerName).toBe('Cal Fire');
    expect(r.rows[1]?.billedCents).toBe(150_000_00);
  });

  it('skips DRAFT + WRITTEN_OFF', () => {
    const r = buildCustomerConcentration({
      start: '2026-04-01',
      end: '2026-04-30',
      arInvoices: [
        ar({ id: '1', status: 'DRAFT', totalCents: 99_999_00 }),
        ar({ id: '2', status: 'WRITTEN_OFF', totalCents: 99_999_00 }),
        ar({ id: '3', status: 'SENT', totalCents: 100_00 }),
      ],
    });
    expect(r.totalBilledCents).toBe(100_00);
  });

  it('filters by date range', () => {
    const r = buildCustomerConcentration({
      start: '2026-04-01',
      end: '2026-04-30',
      arInvoices: [
        ar({ id: '1', invoiceDate: '2026-03-31', totalCents: 99_999_00 }),
        ar({ id: '2', invoiceDate: '2026-04-15', totalCents: 100_00 }),
      ],
    });
    expect(r.totalBilledCents).toBe(100_00);
  });

  it('case-insensitive merges by default; preserves first display', () => {
    const r = buildCustomerConcentration({
      start: '2026-04-01',
      end: '2026-04-30',
      arInvoices: [
        ar({ id: '1', customerName: 'CAL FIRE', totalCents: 100_00 }),
        ar({ id: '2', customerName: 'Cal Fire', totalCents: 200_00 }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.billedCents).toBe(300_00);
  });

  it('top1 / top3 / top5 share', () => {
    const r = buildCustomerConcentration({
      start: '2026-04-01',
      end: '2026-04-30',
      arInvoices: [
        ar({ id: '1', customerName: 'A', totalCents: 700_00 }),
        ar({ id: '2', customerName: 'B', totalCents: 200_00 }),
        ar({ id: '3', customerName: 'C', totalCents: 100_00 }),
      ],
    });
    expect(r.top1SharePct).toBeCloseTo(0.7, 4);
    expect(r.top3SharePct).toBe(1);
  });

  it('HHI maxes near 10000 for monopoly, drops with diffusion', () => {
    const monopoly = buildCustomerConcentration({
      start: '2026-04-01',
      end: '2026-04-30',
      arInvoices: [ar({ id: '1', customerName: 'A', totalCents: 1_000_00 })],
    });
    expect(monopoly.hhi).toBe(10_000); // (1.0)^2 * 10000

    const split = buildCustomerConcentration({
      start: '2026-04-01',
      end: '2026-04-30',
      arInvoices: [
        ar({ id: '1', customerName: 'A', totalCents: 500_00 }),
        ar({ id: '2', customerName: 'B', totalCents: 500_00 }),
      ],
    });
    // (0.5)^2 + (0.5)^2 = 0.5 → 5000
    expect(split.hhi).toBe(5_000);
  });

  it('counts jobs and invoices per customer', () => {
    const r = buildCustomerConcentration({
      start: '2026-04-01',
      end: '2026-04-30',
      arInvoices: [
        ar({ id: '1', customerName: 'A', jobId: 'job-1' }),
        ar({ id: '2', customerName: 'A', jobId: 'job-1' }),
        ar({ id: '3', customerName: 'A', jobId: 'job-2' }),
      ],
    });
    expect(r.rows[0]?.invoiceCount).toBe(3);
    expect(r.rows[0]?.jobCount).toBe(2);
  });

  it('handles empty input cleanly', () => {
    const r = buildCustomerConcentration({
      start: '2026-04-01',
      end: '2026-04-30',
      arInvoices: [],
    });
    expect(r.rows).toHaveLength(0);
    expect(r.totalBilledCents).toBe(0);
    expect(r.top1SharePct).toBe(0);
    expect(r.hhi).toBe(0);
  });
});
