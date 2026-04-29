import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { ArInvoice } from './ar-invoice';
import type { Job } from './job';

import { buildCustomerMarginYoy } from './customer-margin-yoy';

function job(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '',
    updatedAt: '',
    projectName: 'Test',
    projectType: 'ROAD_RECONSTRUCTION',
    contractType: 'PUBLIC',
    status: 'AWARDED',
    ownerAgency: 'Caltrans D2',
    ...over,
  } as Job;
}

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    customerName: 'Caltrans D2',
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

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '',
    updatedAt: '',
    vendorName: 'V',
    invoiceDate: '2026-04-15',
    jobId: 'j1',
    lineItems: [],
    totalCents: 30_000_00,
    paidCents: 0,
    status: 'PENDING',
    ...over,
  } as ApInvoice;
}

describe('buildCustomerMarginYoy', () => {
  it('compares prior vs current year per customer', () => {
    const r = buildCustomerMarginYoy({
      currentYear: 2026,
      jobs: [job({ id: 'j1' })],
      customers: [],
      arInvoices: [
        ar({ id: 'a', invoiceDate: '2025-04-15', totalCents: 80_000_00 }),
        ar({ id: 'b', invoiceDate: '2026-04-15', totalCents: 100_000_00 }),
      ],
      apInvoices: [
        ap({ id: 'x', invoiceDate: '2025-04-15', totalCents: 20_000_00 }),
        ap({ id: 'y', invoiceDate: '2026-04-15', totalCents: 30_000_00 }),
      ],
      expenses: [],
    });
    expect(r.rows[0]?.priorBilledCents).toBe(80_000_00);
    expect(r.rows[0]?.priorMarginPct).toBe(0.75);
    expect(r.rows[0]?.currentMarginPct).toBe(0.7);
    expect(r.rows[0]?.marginPctDelta).toBeCloseTo(-0.05);
    expect(r.rows[0]?.billedDelta).toBe(20_000_00);
  });

  it('returns null marginPct when billed=0 in a year', () => {
    const r = buildCustomerMarginYoy({
      currentYear: 2026,
      jobs: [job({ id: 'j1' })],
      customers: [],
      arInvoices: [ar({ invoiceDate: '2026-04-15' })],
      apInvoices: [],
      expenses: [],
    });
    expect(r.rows[0]?.priorMarginPct).toBeNull();
    expect(r.rows[0]?.marginPctDelta).toBeNull();
  });

  it('ignores invoices outside the two-year window', () => {
    const r = buildCustomerMarginYoy({
      currentYear: 2026,
      jobs: [job({ id: 'j1' })],
      customers: [],
      arInvoices: [
        ar({ id: 'old', invoiceDate: '2024-04-15' }),
        ar({ id: 'in', invoiceDate: '2026-04-15' }),
      ],
      apInvoices: [],
      expenses: [],
    });
    expect(r.rows[0]?.priorBilledCents).toBe(0);
    expect(r.rows[0]?.currentBilledCents).toBe(100_000_00);
  });

  it('rolls up portfolio totals', () => {
    const r = buildCustomerMarginYoy({
      currentYear: 2026,
      jobs: [job({ id: 'j1' })],
      customers: [],
      arInvoices: [
        ar({ id: 'a', invoiceDate: '2025-04-15', totalCents: 80_000_00 }),
        ar({ id: 'b', invoiceDate: '2026-04-15', totalCents: 100_000_00 }),
      ],
      apInvoices: [],
      expenses: [],
    });
    expect(r.rollup.priorYear).toBe(2025);
    expect(r.rollup.currentYear).toBe(2026);
    expect(r.rollup.priorBilledCents).toBe(80_000_00);
    expect(r.rollup.currentBilledCents).toBe(100_000_00);
  });

  it('sorts by currentBilledCents desc', () => {
    const r = buildCustomerMarginYoy({
      currentYear: 2026,
      jobs: [
        job({ id: 'jA', ownerAgency: 'A Agency' }),
        job({ id: 'jZ', ownerAgency: 'Z Agency' }),
      ],
      customers: [],
      arInvoices: [
        ar({ id: 'a', jobId: 'jA', customerName: 'A Agency', invoiceDate: '2026-04-15', totalCents: 50_000_00 }),
        ar({ id: 'b', jobId: 'jZ', customerName: 'Z Agency', invoiceDate: '2026-04-15', totalCents: 100_000_00 }),
      ],
      apInvoices: [],
      expenses: [],
    });
    expect(r.rows[0]?.customerName).toBe('Z Agency');
  });

  it('handles empty input', () => {
    const r = buildCustomerMarginYoy({
      currentYear: 2026,
      jobs: [],
      customers: [],
      arInvoices: [],
      apInvoices: [],
      expenses: [],
    });
    expect(r.rows).toHaveLength(0);
  });
});
