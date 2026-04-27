import { describe, expect, it } from 'vitest';
import {
  buildJobRetentionStatus,
  computeRetentionRollup,
} from './retention';
import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';

function inv(over: Partial<ArInvoice>): ArInvoice {
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
    subtotalCents: 100_000_00,
    totalCents: 95_000_00,
    paidCents: 0,
    status: 'SENT',
    ...over,
  };
}

function pay(over: Partial<ArPayment>): ArPayment {
  return {
    id: 'arp-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    arInvoiceId: 'ar-aaaaaaaa',
    jobId: 'job-2026-01-01-test-aaaaaaaa',
    kind: 'PROGRESS',
    method: 'CHECK',
    receivedOn: '2026-04-15',
    amountCents: 0,
    ...over,
  };
}

describe('buildJobRetentionStatus', () => {
  it('sums retention held across invoices and subtracts retention release payments', () => {
    const r = buildJobRetentionStatus({
      jobId: 'job-2026-01-01-x-aaaaaaaa',
      customerName: 'Cal Fire',
      invoices: [
        inv({ id: 'ar-11111111', retentionCents: 5_000_00 }),
        inv({ id: 'ar-22222222', retentionCents: 5_000_00 }),
      ],
      payments: [
        pay({ id: 'arp-11111111', kind: 'PROGRESS', amountCents: 90_000_00 }),
        pay({ id: 'arp-22222222', kind: 'RETENTION_RELEASE', amountCents: 3_000_00 }),
      ],
    });
    expect(r.totalRetentionHeldCents).toBe(10_000_00);
    expect(r.totalRetentionReleasedCents).toBe(3_000_00);
    expect(r.outstandingRetentionCents).toBe(7_000_00);
  });

  it('returns null for §7107 when no completion-notice date is given', () => {
    const r = buildJobRetentionStatus({
      jobId: 'job-2026-01-01-x-aaaaaaaa',
      customerName: 'Cal Fire',
      invoices: [inv({ id: 'ar-11111111', retentionCents: 10_000_00 })],
      payments: [],
    });
    expect(r.ca7107).toBe(null);
  });

  it('returns §7107 daysLate=0 when completion date is recent', () => {
    const r = buildJobRetentionStatus({
      jobId: 'job-2026-01-01-x-aaaaaaaa',
      customerName: 'Cal Fire',
      invoices: [inv({ id: 'ar-11111111', retentionCents: 10_000_00 })],
      payments: [],
      completionNoticeDate: '2026-04-01',
      now: new Date('2026-04-15T00:00:00Z'),
    });
    expect(r.ca7107).not.toBeNull();
    expect(r.ca7107!.daysLate).toBe(0);
    expect(r.ca7107!.interestCents).toBe(0);
  });
});

describe('computeRetentionRollup', () => {
  it('separates total outstanding from past-due outstanding', () => {
    const onTime = buildJobRetentionStatus({
      jobId: 'job-1',
      customerName: 'A',
      invoices: [inv({ id: 'ar-11111111', retentionCents: 5_000_00 })],
      payments: [],
      completionNoticeDate: '2026-04-01',
      now: new Date('2026-04-15T00:00:00Z'),
    });
    const overdue = buildJobRetentionStatus({
      jobId: 'job-2',
      customerName: 'B',
      invoices: [inv({ id: 'ar-22222222', retentionCents: 10_000_00 })],
      payments: [],
      completionNoticeDate: '2026-01-01',
      now: new Date('2026-04-15T00:00:00Z'),
    });
    const rollup = computeRetentionRollup([onTime, overdue]);
    expect(rollup.jobsWithRetention).toBe(2);
    expect(rollup.totalOutstandingCents).toBe(15_000_00);
    expect(rollup.pastDueJobCount).toBe(1);
    expect(rollup.pastDueOutstandingCents).toBe(10_000_00);
    expect(rollup.totalAccruedInterestCents).toBeGreaterThan(0);
  });
});
