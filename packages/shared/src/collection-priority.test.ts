import { describe, expect, it } from 'vitest';
import { buildCollectionPriority } from './collection-priority';
import type { ArInvoice } from './ar-invoice';

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'job-1',
    invoiceNumber: '1',
    customerName: 'Cal Fire',
    invoiceDate: '2026-01-01',
    dueDate: '2026-01-31',
    source: 'MANUAL',
    lineItems: [],
    subtotalCents: 100_00,
    totalCents: 100_00,
    paidCents: 0,
    status: 'SENT',
    ...over,
  } as ArInvoice;
}

describe('buildCollectionPriority', () => {
  it('skips DRAFT, PAID, WRITTEN_OFF + zero-balance invoices', () => {
    const r = buildCollectionPriority({
      asOf: '2026-04-27',
      arInvoices: [
        ar({ id: '1', status: 'DRAFT' }),
        ar({ id: '2', status: 'PAID', paidCents: 100_00 }),
        ar({ id: '3', status: 'WRITTEN_OFF' }),
        ar({ id: '4', status: 'SENT', totalCents: 100_00, paidCents: 100_00 }),
        ar({ id: '5', status: 'SENT' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('aggregates by customerName (case-insensitive)', () => {
    const r = buildCollectionPriority({
      asOf: '2026-04-27',
      arInvoices: [
        ar({ id: '1', customerName: 'Cal Fire', totalCents: 100_00 }),
        ar({ id: '2', customerName: 'CAL FIRE', totalCents: 200_00 }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.openBalanceCents).toBe(300_00);
  });

  it('uses dueDate when set; else Net-30 from invoiceDate', () => {
    const r = buildCollectionPriority({
      asOf: '2026-04-27',
      arInvoices: [
        ar({ id: '1', invoiceDate: '2026-01-01', dueDate: undefined, customerName: 'A' }),
      ],
    });
    // Net-30 from 01-01 = 01-31. From 01-31 to 04-27 = 86 days.
    expect(r.rows[0]?.oldestDaysOverdue).toBeGreaterThanOrEqual(85);
  });

  it('sorts highest priorityScore first', () => {
    const r = buildCollectionPriority({
      asOf: '2026-04-27',
      arInvoices: [
        // Big + old → top priority
        ar({ id: 'big-old', customerName: 'Big Old', dueDate: '2026-01-01', totalCents: 500_000_00 }),
        // Small + recent → bottom
        ar({ id: 'small-new', customerName: 'Small New', dueDate: '2026-04-30', totalCents: 100_00 }),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('Big Old');
  });

  it('shareOfOutstanding sums to 1', () => {
    const r = buildCollectionPriority({
      asOf: '2026-04-27',
      arInvoices: [
        ar({ id: '1', customerName: 'A', totalCents: 600_00 }),
        ar({ id: '2', customerName: 'B', totalCents: 400_00 }),
      ],
    });
    const sum = r.rows.reduce((s, x) => s + x.shareOfOutstanding, 0);
    expect(sum).toBeCloseTo(1, 4);
  });

  it('priorityScore is bounded 0-100', () => {
    const r = buildCollectionPriority({
      asOf: '2026-04-27',
      arInvoices: [
        ar({
          id: '1',
          customerName: 'Mega',
          dueDate: '2025-01-01', // way overdue
          totalCents: 10_000_000_00, // $10M
        }),
      ],
    });
    expect(r.rows[0]?.priorityScore).toBeLessThanOrEqual(100);
    expect(r.rows[0]?.priorityScore).toBeGreaterThan(60);
  });

  it('totalOutstandingCents = sum across rows', () => {
    const r = buildCollectionPriority({
      asOf: '2026-04-27',
      arInvoices: [
        ar({ id: '1', customerName: 'A', totalCents: 100_00, paidCents: 50_00 }),
        ar({ id: '2', customerName: 'B', totalCents: 200_00 }),
      ],
    });
    expect(r.totalOutstandingCents).toBe(250_00);
  });
});
