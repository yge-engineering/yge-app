import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';

import { buildArAgingByJob } from './ar-aging-by-job';

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

describe('buildArAgingByJob', () => {
  it('groups by jobId', () => {
    const r = buildArAgingByJob({
      asOf: '2026-04-28',
      arInvoices: [
        ar({ id: 'a', jobId: 'j1' }),
        ar({ id: 'b', jobId: 'j2' }),
        ar({ id: 'c', jobId: 'j1' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('buckets unpaid balance by aging', () => {
    const r = buildArAgingByJob({
      asOf: '2026-04-28',
      arInvoices: [
        ar({ id: 'cur', invoiceDate: '2026-04-28', totalCents: 10_000_00 }),
        ar({ id: '15', invoiceDate: '2026-04-13', totalCents: 20_000_00 }),
        ar({ id: '50', invoiceDate: '2026-03-09', totalCents: 30_000_00 }),
        ar({ id: '120', invoiceDate: '2025-12-29', totalCents: 50_000_00 }),
      ],
    });
    expect(r.rows[0]?.currentCents).toBe(10_000_00);
    expect(r.rows[0]?.past1_30Cents).toBe(20_000_00);
    expect(r.rows[0]?.past31_60Cents).toBe(30_000_00);
    expect(r.rows[0]?.past90PlusCents).toBe(50_000_00);
  });

  it('skips PAID + WRITTEN_OFF', () => {
    const r = buildArAgingByJob({
      asOf: '2026-04-28',
      arInvoices: [
        ar({ id: 'a', status: 'PAID' }),
        ar({ id: 'b', status: 'WRITTEN_OFF' }),
        ar({ id: 'c', status: 'SENT' }),
      ],
    });
    expect(r.rollup.invoicesConsidered).toBe(1);
  });

  it('uses unpaid balance', () => {
    const r = buildArAgingByJob({
      asOf: '2026-04-28',
      arInvoices: [ar({ totalCents: 100_000_00, paidCents: 30_000_00 })],
    });
    expect(r.rows[0]?.totalUnpaidCents).toBe(70_000_00);
  });

  it('tracks oldestInvoiceDate', () => {
    const r = buildArAgingByJob({
      asOf: '2026-04-28',
      arInvoices: [
        ar({ id: 'a', invoiceDate: '2026-02-15' }),
        ar({ id: 'b', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.oldestInvoiceDate).toBe('2026-02-15');
  });

  it('sorts by totalUnpaidCents desc', () => {
    const r = buildArAgingByJob({
      asOf: '2026-04-28',
      arInvoices: [
        ar({ id: 'a', jobId: 'small', totalCents: 5_000_00 }),
        ar({ id: 'b', jobId: 'big', totalCents: 100_000_00 }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('big');
  });

  it('handles empty input', () => {
    const r = buildArAgingByJob({ arInvoices: [] });
    expect(r.rows).toHaveLength(0);
  });
});
