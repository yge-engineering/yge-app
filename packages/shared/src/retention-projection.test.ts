import { describe, expect, it } from 'vitest';
import { buildRetentionProjection } from './retention-projection';
import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';

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
    subtotalCents: 100_000_00,
    totalCents: 100_000_00,
    paidCents: 90_000_00,
    retentionCents: 10_000_00,
    status: 'PARTIALLY_PAID',
    ...over,
  } as ArInvoice;
}

function pay(over: Partial<ArPayment>): ArPayment {
  return {
    id: 'pay-1',
    createdAt: '',
    updatedAt: '',
    arInvoiceId: 'ar-1',
    jobId: 'job-1',
    kind: 'RETENTION_RELEASE',
    method: 'CHECK',
    receivedOn: '2026-04-15',
    amountCents: 0,
    ...over,
  } as ArPayment;
}

describe('buildRetentionProjection', () => {
  it('rolls retention held + released per job', () => {
    const r = buildRetentionProjection({
      asOf: '2026-04-27',
      arInvoices: [
        ar({ id: 'i1', jobId: 'job-A', retentionCents: 10_000_00 }),
        ar({ id: 'i2', jobId: 'job-A', retentionCents: 5_000_00 }),
      ],
      arPayments: [pay({ jobId: 'job-A', amountCents: 3_000_00 })],
    });
    const row = r.rows[0]!;
    expect(row.retentionHeldCents).toBe(15_000_00);
    expect(row.retentionReleasedCents).toBe(3_000_00);
    expect(row.outstandingRetentionCents).toBe(12_000_00);
  });

  it('skips jobs with no retention', () => {
    const r = buildRetentionProjection({
      asOf: '2026-04-27',
      arInvoices: [ar({ retentionCents: 0 })],
      arPayments: [],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('skips DRAFT and WRITTEN_OFF AR invoices', () => {
    const r = buildRetentionProjection({
      asOf: '2026-04-27',
      arInvoices: [
        ar({ id: '1', status: 'DRAFT', retentionCents: 99_999_00 }),
        ar({ id: '2', status: 'WRITTEN_OFF', retentionCents: 99_999_00 }),
        ar({ id: '3', status: 'PAID', retentionCents: 1_000_00 }),
      ],
      arPayments: [],
    });
    expect(r.rows[0]?.retentionHeldCents).toBe(1_000_00);
  });

  it('NO_DATE bucket when no completion notice supplied', () => {
    const r = buildRetentionProjection({
      asOf: '2026-04-27',
      arInvoices: [ar({ retentionCents: 10_000_00 })],
      arPayments: [],
    });
    expect(r.rows[0]?.bucket).toBe('NO_DATE');
  });

  it('DUE_NOW when expectedRelease has passed', () => {
    const r = buildRetentionProjection({
      asOf: '2026-04-27',
      arInvoices: [ar({ jobId: 'job-A', retentionCents: 10_000_00 })],
      arPayments: [],
      // Completion 2026-01-01 → release 2026-03-02 → 56 days overdue
      completionNoticeByJobId: new Map([['job-A', '2026-01-01']]),
    });
    expect(r.rows[0]?.bucket).toBe('DUE_NOW');
    expect(r.rows[0]?.daysToRelease).toBeLessThan(0);
  });

  it('DUE_30 / DUE_60 / DUE_90 bucketing', () => {
    const r = buildRetentionProjection({
      asOf: '2026-04-27',
      arInvoices: [
        ar({ id: '1', jobId: 'job-30', retentionCents: 10_000_00 }),
        ar({ id: '2', jobId: 'job-60', retentionCents: 10_000_00 }),
        ar({ id: '3', jobId: 'job-90', retentionCents: 10_000_00 }),
      ],
      arPayments: [],
      completionNoticeByJobId: new Map([
        ['job-30', '2026-03-12'], // +60 = 2026-05-11 → 14 days out
        ['job-60', '2026-04-01'], // +60 = 2026-05-31 → 34 days out
        ['job-90', '2026-05-01'], // +60 = 2026-06-30 → 64 days out
      ]),
    });
    const byJob = new Map(r.rows.map((x) => [x.jobId, x.bucket]));
    expect(byJob.get('job-30')).toBe('DUE_30');
    expect(byJob.get('job-60')).toBe('DUE_60');
    expect(byJob.get('job-90')).toBe('DUE_90');
  });

  it('rollup totals by bucket', () => {
    const r = buildRetentionProjection({
      asOf: '2026-04-27',
      arInvoices: [
        ar({ id: '1', jobId: 'overdue', retentionCents: 5_000_00 }),
        ar({ id: '2', jobId: 'noDate', retentionCents: 7_000_00 }),
      ],
      arPayments: [],
      completionNoticeByJobId: new Map([['overdue', '2026-01-01']]),
    });
    expect(r.rollup.totalOutstandingCents).toBe(12_000_00);
    expect(r.rollup.byBucket.DUE_NOW).toBe(5_000_00);
    expect(r.rollup.byBucket.NO_DATE).toBe(7_000_00);
  });

  it('uses customerNameByJobId override when provided', () => {
    const r = buildRetentionProjection({
      asOf: '2026-04-27',
      arInvoices: [ar({ jobId: 'job-1', customerName: 'Old Name' })],
      arPayments: [],
      customerNameByJobId: new Map([['job-1', 'New Display Name']]),
    });
    expect(r.rows[0]?.customerName).toBe('New Display Name');
  });
});
