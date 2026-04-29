import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';

import { buildPortfolioCustomerYoy } from './portfolio-customer-yoy';

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    customerName: 'CAL FIRE',
    invoiceDate: '2026-04-15',
    invoiceNumber: '1',
    lineItems: [],
    subtotalCents: 0,
    totalCents: 100_000_00,
    paidCents: 0,
    status: 'SENT',
    source: 'MANUAL',
    ...over,
  } as ArInvoice;
}

describe('buildPortfolioCustomerYoy', () => {
  it('compares prior vs current totals + retention', () => {
    const r = buildPortfolioCustomerYoy({
      currentYear: 2026,
      arInvoices: [
        ar({ id: 'a', invoiceDate: '2025-04-15', totalCents: 80_000_00, retentionCents: 4_000_00 }),
        ar({ id: 'b', invoiceDate: '2026-04-15', totalCents: 100_000_00, retentionCents: 5_000_00 }),
      ],
    });
    expect(r.priorTotalCents).toBe(80_000_00);
    expect(r.currentTotalCents).toBe(100_000_00);
    expect(r.priorRetentionCents).toBe(4_000_00);
    expect(r.currentRetentionCents).toBe(5_000_00);
    expect(r.totalCentsDelta).toBe(20_000_00);
  });

  it('counts distinct customers + jobs', () => {
    const r = buildPortfolioCustomerYoy({
      currentYear: 2026,
      arInvoices: [
        ar({ id: 'a', customerName: 'CAL FIRE', jobId: 'j1' }),
        ar({ id: 'b', customerName: 'Caltrans', jobId: 'j2' }),
        ar({ id: 'c', customerName: 'CAL FIRE', jobId: 'j1' }),
      ],
    });
    expect(r.currentDistinctCustomers).toBe(2);
    expect(r.currentDistinctJobs).toBe(2);
  });

  it('ignores out-of-window dates', () => {
    const r = buildPortfolioCustomerYoy({
      currentYear: 2026,
      arInvoices: [
        ar({ id: 'a', invoiceDate: '2024-04-15' }),
      ],
    });
    expect(r.priorTotalCents).toBe(0);
    expect(r.currentTotalCents).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioCustomerYoy({ currentYear: 2026, arInvoices: [] });
    expect(r.currentInvoiceCount).toBe(0);
  });
});
