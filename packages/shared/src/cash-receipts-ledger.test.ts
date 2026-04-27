import { describe, expect, it } from 'vitest';

import type { ArPayment } from './ar-payment';

import { buildCashReceiptsLedger } from './cash-receipts-ledger';

function pay(over: Partial<ArPayment>): ArPayment {
  return {
    id: 'arp-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    arInvoiceId: 'ar-1',
    jobId: 'job-1',
    kind: 'PROGRESS',
    method: 'CHECK',
    receivedOn: '2026-04-15',
    amountCents: 10_000_00,
    ...over,
  } as ArPayment;
}

describe('buildCashReceiptsLedger', () => {
  it('respects window bounds', () => {
    const r = buildCashReceiptsLedger({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arPayments: [
        pay({ id: 'p-old', receivedOn: '2026-03-15' }),
        pay({ id: 'p-in', receivedOn: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.date).toBe('2026-04-15');
  });

  it('groups payments by receivedOn date', () => {
    const r = buildCashReceiptsLedger({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arPayments: [
        pay({ id: 'p-1', receivedOn: '2026-04-15', amountCents: 5_000_00 }),
        pay({ id: 'p-2', receivedOn: '2026-04-15', amountCents: 7_000_00 }),
        pay({ id: 'p-3', receivedOn: '2026-04-20', amountCents: 3_000_00 }),
      ],
    });
    expect(r.rows).toHaveLength(2);
    const day15 = r.rows.find((x) => x.date === '2026-04-15');
    expect(day15?.totalCents).toBe(12_000_00);
    expect(day15?.paymentCount).toBe(2);
  });

  it('breaks total down by kind', () => {
    const r = buildCashReceiptsLedger({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arPayments: [
        pay({ id: 'p-1', kind: 'PROGRESS', amountCents: 50_000_00 }),
        pay({ id: 'p-2', kind: 'RETENTION_RELEASE', amountCents: 30_000_00 }),
        pay({ id: 'p-3', kind: 'FINAL', amountCents: 10_000_00 }),
      ],
    });
    expect(r.rows[0]?.byKind.PROGRESS).toBe(50_000_00);
    expect(r.rows[0]?.byKind.RETENTION_RELEASE).toBe(30_000_00);
    expect(r.rows[0]?.byKind.FINAL).toBe(10_000_00);
    expect(r.rows[0]?.byKind.PARTIAL).toBe(0);
    expect(r.rows[0]?.byKind.OTHER).toBe(0);
  });

  it('counts distinct jobs per day', () => {
    const r = buildCashReceiptsLedger({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arPayments: [
        pay({ id: 'p-1', jobId: 'job-A' }),
        pay({ id: 'p-2', jobId: 'job-B' }),
        pay({ id: 'p-3', jobId: 'job-A' }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('uses customerNameByInvoiceId when supplied for distinctCustomers', () => {
    const r = buildCashReceiptsLedger({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      customerNameByInvoiceId: new Map([
        ['ar-1', 'Cal Fire'],
        ['ar-2', 'Cal Fire'], // same customer, different invoice
        ['ar-3', 'Caltrans'],
      ]),
      arPayments: [
        pay({ id: 'p-1', arInvoiceId: 'ar-1' }),
        pay({ id: 'p-2', arInvoiceId: 'ar-2' }),
        pay({ id: 'p-3', arInvoiceId: 'ar-3' }),
      ],
    });
    expect(r.rows[0]?.distinctCustomers).toBe(2);
  });

  it('falls back to arInvoiceId when no customer map supplied', () => {
    const r = buildCashReceiptsLedger({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arPayments: [
        pay({ id: 'p-1', arInvoiceId: 'ar-1' }),
        pay({ id: 'p-2', arInvoiceId: 'ar-2' }),
      ],
    });
    expect(r.rows[0]?.distinctCustomers).toBe(2);
  });

  it('rolls up totals + peak day + avg', () => {
    const r = buildCashReceiptsLedger({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arPayments: [
        pay({ id: 'p-light', receivedOn: '2026-04-01', amountCents: 5_000_00 }),
        pay({ id: 'p-heavy', receivedOn: '2026-04-15', amountCents: 50_000_00 }),
      ],
    });
    expect(r.rollup.daysWithReceipts).toBe(2);
    expect(r.rollup.totalCents).toBe(55_000_00);
    expect(r.rollup.peakDayCents).toBe(50_000_00);
    expect(r.rollup.peakDayDate).toBe('2026-04-15');
    expect(r.rollup.avgPerActiveDayCents).toBe(27_500_00);
  });

  it('rolls up totalByKind across the window', () => {
    const r = buildCashReceiptsLedger({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arPayments: [
        pay({ id: 'p-1', kind: 'PROGRESS', amountCents: 30_000_00 }),
        pay({ id: 'p-2', kind: 'RETENTION_RELEASE', amountCents: 20_000_00 }),
      ],
    });
    expect(r.rollup.totalByKind.PROGRESS).toBe(30_000_00);
    expect(r.rollup.totalByKind.RETENTION_RELEASE).toBe(20_000_00);
  });

  it('sorts rows by date asc', () => {
    const r = buildCashReceiptsLedger({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arPayments: [
        pay({ id: 'p-late', receivedOn: '2026-04-25' }),
        pay({ id: 'p-early', receivedOn: '2026-04-05' }),
      ],
    });
    expect(r.rows[0]?.date).toBe('2026-04-05');
    expect(r.rows[1]?.date).toBe('2026-04-25');
  });

  it('handles empty input gracefully', () => {
    const r = buildCashReceiptsLedger({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arPayments: [],
    });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.peakDayDate).toBe(null);
    expect(r.rollup.totalCents).toBe(0);
  });
});
