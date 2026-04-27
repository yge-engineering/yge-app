import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';

import { buildApProcessingTime } from './ap-processing-time';

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '2026-04-05T00:00:00.000Z',
    updatedAt: '2026-04-05T00:00:00.000Z',
    vendorName: 'Acme Supply LLC',
    invoiceDate: '2026-04-01',
    lineItems: [],
    totalCents: 100_00,
    paidCents: 100_00,
    status: 'APPROVED',
    approvedAt: '2026-04-08T00:00:00.000Z',
    ...over,
  } as ApInvoice;
}

describe('buildApProcessingTime', () => {
  it('skips DRAFT and REJECTED invoices', () => {
    const r = buildApProcessingTime({
      apInvoices: [
        ap({ id: 'ap-1', status: 'DRAFT' }),
        ap({ id: 'ap-2', status: 'REJECTED' }),
      ],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('computes entry lag from invoiceDate to createdAt', () => {
    const r = buildApProcessingTime({
      apInvoices: [
        ap({
          invoiceDate: '2026-04-01',
          createdAt: '2026-04-05T00:00:00.000Z',
        }),
      ],
    });
    expect(r.rows[0]?.avgEntryLagDays).toBe(4);
  });

  it('computes approval lag from createdAt to approvedAt', () => {
    const r = buildApProcessingTime({
      apInvoices: [
        ap({
          createdAt: '2026-04-05T00:00:00.000Z',
          approvedAt: '2026-04-08T00:00:00.000Z',
        }),
      ],
    });
    expect(r.rows[0]?.avgApprovalLagDays).toBe(3);
  });

  it('computes total invoice → approved days', () => {
    const r = buildApProcessingTime({
      apInvoices: [
        ap({
          invoiceDate: '2026-04-01',
          approvedAt: '2026-04-08T00:00:00.000Z',
        }),
      ],
    });
    expect(r.rows[0]?.avgTotalToApprovedDays).toBe(7);
  });

  it('counts invoices by status', () => {
    const r = buildApProcessingTime({
      apInvoices: [
        ap({ id: 'ap-1', status: 'PENDING', approvedAt: undefined }),
        ap({ id: 'ap-2', status: 'APPROVED' }),
        ap({ id: 'ap-3', status: 'PAID' }),
      ],
    });
    expect(r.rows[0]?.pendingCount).toBe(1);
    expect(r.rows[0]?.approvedCount).toBe(1);
    expect(r.rows[0]?.paidCount).toBe(1);
    expect(r.rows[0]?.invoicesConsidered).toBe(3);
  });

  it('handles missing approvedAt gracefully (entry lag still recorded)', () => {
    const r = buildApProcessingTime({
      apInvoices: [
        ap({ status: 'PENDING', approvedAt: undefined }),
      ],
    });
    expect(r.rows[0]?.avgEntryLagDays).toBeGreaterThan(0);
    expect(r.rows[0]?.avgApprovalLagDays).toBe(0);
  });

  it('respects fromDate / toDate window', () => {
    const r = buildApProcessingTime({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      apInvoices: [
        ap({ id: 'ap-old', invoiceDate: '2026-03-01' }),
        ap({ id: 'ap-in', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.invoicesConsidered).toBe(1);
  });

  it('rolls up global stage stats across invoices', () => {
    const r = buildApProcessingTime({
      apInvoices: [
        ap({ id: 'ap-1', invoiceDate: '2026-04-01', createdAt: '2026-04-05T00:00:00.000Z', approvedAt: '2026-04-08T00:00:00.000Z' }),
        ap({ id: 'ap-2', invoiceDate: '2026-04-01', createdAt: '2026-04-03T00:00:00.000Z', approvedAt: '2026-04-04T00:00:00.000Z' }),
      ],
    });
    expect(r.rollup.invoicesConsidered).toBe(2);
    expect(r.rollup.entryLag.count).toBe(2);
    expect(r.rollup.entryLag.avgDays).toBe(3); // (4+2)/2
    expect(r.rollup.entryLag.worstDays).toBe(4);
    expect(r.rollup.approvalLag.avgDays).toBe(2); // (3+1)/2
  });

  it('flags vendors with avgTotalToApproved > 7 days', () => {
    const r = buildApProcessingTime({
      apInvoices: [
        ap({
          id: 'ap-fast',
          vendorName: 'Fast Vendor',
          invoiceDate: '2026-04-01',
          approvedAt: '2026-04-04T00:00:00.000Z',
        }),
        ap({
          id: 'ap-slow',
          vendorName: 'Slow Vendor',
          invoiceDate: '2026-04-01',
          approvedAt: '2026-04-20T00:00:00.000Z',
        }),
      ],
    });
    expect(r.rollup.bottleneckVendorCount).toBe(1);
  });

  it('sorts vendors by slowest avg total first', () => {
    const r = buildApProcessingTime({
      apInvoices: [
        ap({
          id: 'ap-fast',
          vendorName: 'Fast',
          invoiceDate: '2026-04-01',
          approvedAt: '2026-04-04T00:00:00.000Z',
        }),
        ap({
          id: 'ap-slow',
          vendorName: 'Slow',
          invoiceDate: '2026-04-01',
          approvedAt: '2026-04-20T00:00:00.000Z',
        }),
      ],
    });
    expect(r.rows[0]?.vendorName).toBe('Slow');
  });
});
