import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';

import { buildCustomerPaymentVelocity } from './customer-payment-velocity';

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    jobId: 'job-1',
    invoiceNumber: '1',
    customerName: 'Cal Fire',
    invoiceDate: '2026-01-01',
    sentAt: '2026-01-01T00:00:00.000Z',
    source: 'PROGRESS',
    lineItems: [],
    subtotalCents: 100_00,
    totalCents: 100_00,
    paidCents: 100_00,
    status: 'PAID',
    lastPaymentAt: '2026-01-25',
    ...over,
  } as ArInvoice;
}

describe('buildCustomerPaymentVelocity', () => {
  it('skips invoices that are not PAID', () => {
    const r = buildCustomerPaymentVelocity({
      arInvoices: [
        ar({ status: 'SENT' }),
        ar({ status: 'PARTIALLY_PAID' }),
      ],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('flags ON_TIME for payment within 5 days of due', () => {
    // sentAt 2026-01-01, paidOn 2026-01-31, due 30d → exactly 0 days vs due
    const r = buildCustomerPaymentVelocity({
      arInvoices: [ar({ lastPaymentAt: '2026-01-31' })],
    });
    expect(r.rows[0]?.onTimeCount).toBe(1);
    expect(r.rows[0]?.worstFlag).toBe('ON_TIME');
  });

  it('flags EARLY when paid more than 5 days before due', () => {
    const r = buildCustomerPaymentVelocity({
      arInvoices: [ar({ lastPaymentAt: '2026-01-15' })], // 16 days early
    });
    expect(r.rows[0]?.earlyCount).toBe(1);
  });

  it('flags LATE when 6-15 days past due', () => {
    const r = buildCustomerPaymentVelocity({
      arInvoices: [ar({ lastPaymentAt: '2026-02-10' })], // 10 days late
    });
    expect(r.rows[0]?.lateCount).toBe(1);
  });

  it('flags VERY_LATE when 16+ days past due', () => {
    const r = buildCustomerPaymentVelocity({
      arInvoices: [ar({ lastPaymentAt: '2026-02-25' })], // 25 days late
    });
    expect(r.rows[0]?.veryLateCount).toBe(1);
  });

  it('uses explicit dueDate when set', () => {
    const r = buildCustomerPaymentVelocity({
      arInvoices: [
        ar({
          dueDate: '2026-01-15',
          lastPaymentAt: '2026-01-30', // 15 days late vs explicit due
        }),
      ],
    });
    expect(r.rows[0]?.lateCount).toBe(1);
  });

  it('falls back to invoiceDate when sentAt missing', () => {
    const r = buildCustomerPaymentVelocity({
      arInvoices: [
        ar({
          sentAt: undefined,
          invoiceDate: '2026-01-01',
          lastPaymentAt: '2026-01-31',
        }),
      ],
    });
    expect(r.rows[0]?.invoicesPaid).toBe(1);
    expect(r.rows[0]?.onTimeCount).toBe(1);
  });

  it('case-insensitively collapses customer names', () => {
    const r = buildCustomerPaymentVelocity({
      arInvoices: [
        ar({ id: 'ar-1', customerName: 'Cal Fire', lastPaymentAt: '2026-01-31' }),
        ar({ id: 'ar-2', customerName: 'CAL FIRE', lastPaymentAt: '2026-01-31' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.invoicesPaid).toBe(2);
  });

  it('rolls up customers-running-late', () => {
    const r = buildCustomerPaymentVelocity({
      arInvoices: [
        // Customer A: late 25d
        ar({ id: 'ar-a', customerName: 'Slow County', lastPaymentAt: '2026-02-25' }),
        // Customer B: on-time
        ar({ id: 'ar-b', customerName: 'Cal Fire', lastPaymentAt: '2026-01-31' }),
      ],
    });
    expect(r.rollup.customersRunningLate).toBe(1);
  });

  it('sorts customers worst (most-late) first', () => {
    const r = buildCustomerPaymentVelocity({
      arInvoices: [
        ar({ id: 'ar-a', customerName: 'Alpha', lastPaymentAt: '2026-01-31' }), // on-time
        ar({ id: 'ar-b', customerName: 'Beta', lastPaymentAt: '2026-02-25' }),  // very late
      ],
    });
    expect(r.rows[0]?.customerName).toBe('Beta');
  });
});
