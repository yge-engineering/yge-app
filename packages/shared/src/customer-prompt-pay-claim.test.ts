import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';

import { buildCustomerPromptPayClaim } from './customer-prompt-pay-claim';

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    jobId: 'job-1',
    invoiceNumber: '1',
    customerName: 'Cal Fire',
    invoiceDate: '2026-01-15',
    sentAt: '2026-01-15T00:00:00.000Z',
    source: 'PROGRESS',
    lineItems: [],
    subtotalCents: 100_000_00,
    totalCents: 100_000_00,
    paidCents: 0,
    status: 'SENT',
    ...over,
  } as ArInvoice;
}

describe('buildCustomerPromptPayClaim', () => {
  it('skips DRAFT/PAID/WRITTEN_OFF invoices', () => {
    const r = buildCustomerPromptPayClaim({
      asOf: '2026-04-27',
      arInvoices: [
        ar({ id: 'd', status: 'DRAFT' }),
        ar({ id: 'p', status: 'PAID', paidCents: 100_000_00 }),
        ar({ id: 'w', status: 'WRITTEN_OFF' }),
      ],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('skips invoices not yet over the prompt-pay window', () => {
    // sentAt = 2026-04-15, asOf = 2026-04-27 → 12 days. Not yet
    // 30 days late, no interest accrues.
    const r = buildCustomerPromptPayClaim({
      asOf: '2026-04-27',
      arInvoices: [
        ar({ sentAt: '2026-04-15T00:00:00.000Z', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('computes accrued interest at 10% annual default', () => {
    // sentAt = 2026-01-15. Due = 2026-02-14. asOf = 2026-04-27.
    // daysLate = 72. unpaid 100_000_00. dailyRate = 0.10/365.
    // interest = 100_000_00 * 0.10/365 * 72 ≈ 197_260.
    const r = buildCustomerPromptPayClaim({
      asOf: '2026-04-27',
      arInvoices: [ar({})],
    });
    expect(r.rows[0]?.totalAccruedInterestCents).toBeGreaterThan(0);
    expect(r.rows[0]?.invoices[0]?.daysLate).toBe(72);
  });

  it('honors custom annual rate', () => {
    const r1 = buildCustomerPromptPayClaim({
      asOf: '2026-04-27',
      arInvoices: [ar({})],
    });
    const r2 = buildCustomerPromptPayClaim({
      asOf: '2026-04-27',
      annualRate: 0.20, // double the rate
      arInvoices: [ar({})],
    });
    expect(r2.rows[0]?.totalAccruedInterestCents).toBeGreaterThan(
      r1.rows[0]!.totalAccruedInterestCents,
    );
  });

  it('honors custom due-days window', () => {
    // 60-day window means 12-day-old invoice still not eligible.
    const r = buildCustomerPromptPayClaim({
      asOf: '2026-04-27',
      promptPayDueDays: 90,
      arInvoices: [
        ar({ sentAt: '2026-02-15T00:00:00.000Z', invoiceDate: '2026-02-15' }),
      ],
    });
    // 90 days from 2026-02-15 = 2026-05-16, not yet due → no row
    expect(r.rows).toHaveLength(0);
  });

  it('falls back to invoiceDate when sentAt missing', () => {
    const r = buildCustomerPromptPayClaim({
      asOf: '2026-04-27',
      arInvoices: [
        ar({ sentAt: undefined, invoiceDate: '2026-01-15' }),
      ],
    });
    expect(r.rows[0]?.invoices[0]?.daysLate).toBe(72);
  });

  it('groups invoices per customer with totals', () => {
    const r = buildCustomerPromptPayClaim({
      asOf: '2026-04-27',
      arInvoices: [
        ar({ id: 'a', invoiceDate: '2026-01-01', totalCents: 50_000_00 }),
        ar({ id: 'b', invoiceDate: '2026-01-15', totalCents: 30_000_00 }),
      ],
    });
    expect(r.rows[0]?.invoiceCount).toBe(2);
    expect(r.rows[0]?.totalUnpaidCents).toBe(80_000_00);
  });

  it('captures worst days late per customer', () => {
    const r = buildCustomerPromptPayClaim({
      asOf: '2026-04-27',
      arInvoices: [
        ar({ id: 'a', invoiceDate: '2025-12-01' }),
        ar({ id: 'b', invoiceDate: '2026-01-15' }),
      ],
    });
    const cells = r.rows[0]?.invoices ?? [];
    const maxDays = Math.max(...cells.map((c) => c.daysLate));
    expect(r.rows[0]?.worstDaysLate).toBe(maxDays);
  });

  it('sorts customers by claim potential desc', () => {
    const r = buildCustomerPromptPayClaim({
      asOf: '2026-04-27',
      arInvoices: [
        ar({ id: 'small', customerName: 'Small', totalCents: 1_000_00 }),
        ar({ id: 'big', customerName: 'Big', totalCents: 1_000_000_00 }),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('Big');
  });

  it('case-insensitively collapses customer names', () => {
    const r = buildCustomerPromptPayClaim({
      asOf: '2026-04-27',
      arInvoices: [
        ar({ id: 'a', customerName: 'Cal Fire' }),
        ar({ id: 'b', customerName: 'CAL FIRE' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.invoiceCount).toBe(2);
  });
});
