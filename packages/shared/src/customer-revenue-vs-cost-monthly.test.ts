import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { ArInvoice } from './ar-invoice';
import type { Customer } from './customer';
import type { Expense } from './expense';
import type { Job } from './job';

import { buildCustomerRevenueVsCostMonthly } from './customer-revenue-vs-cost-monthly';

function job(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
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
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
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
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    vendorName: 'Granite',
    invoiceDate: '2026-04-15',
    jobId: 'j1',
    lineItems: [],
    totalCents: 30_000_00,
    paidCents: 0,
    status: 'PENDING',
    ...over,
  } as ApInvoice;
}

describe('buildCustomerRevenueVsCostMonthly', () => {
  it('computes billed - cost = margin per (customer, month)', () => {
    const r = buildCustomerRevenueVsCostMonthly({
      jobs: [job({ id: 'j1' })],
      customers: [],
      arInvoices: [ar({ totalCents: 100_000_00 })],
      apInvoices: [ap({ totalCents: 30_000_00 })],
      expenses: [],
    });
    expect(r.rows[0]?.billedCents).toBe(100_000_00);
    expect(r.rows[0]?.costCents).toBe(30_000_00);
    expect(r.rows[0]?.marginCents).toBe(70_000_00);
    expect(r.rows[0]?.marginPct).toBe(0.7);
  });

  it('matches AR via customer master legalName', () => {
    const cust = {
      id: 'c1',
      createdAt: '',
      updatedAt: '',
      legalName: 'Caltrans D2',
      dbaName: 'CALTRANS DISTRICT 2',
      kind: 'STATE_AGENCY',
    } as Customer;
    const r = buildCustomerRevenueVsCostMonthly({
      jobs: [job({ id: 'j1' })],
      customers: [cust],
      arInvoices: [ar({ customerName: 'CALTRANS DISTRICT 2', totalCents: 50_000_00 })],
      apInvoices: [],
      expenses: [],
    });
    expect(r.rows[0]?.customerName).toBe('Caltrans D2');
  });

  it('rolls expenses into cost', () => {
    const exp = {
      id: 'ex-1',
      createdAt: '',
      updatedAt: '',
      employeeName: 'Pat',
      receiptDate: '2026-04-20',
      amountCents: 5_000_00,
      category: 'FUEL',
      jobId: 'j1',
      description: 'fuel',
      reimbursed: false,
    } as Expense;
    const r = buildCustomerRevenueVsCostMonthly({
      jobs: [job({ id: 'j1' })],
      customers: [],
      arInvoices: [],
      apInvoices: [],
      expenses: [exp],
    });
    expect(r.rows[0]?.costCents).toBe(5_000_00);
  });

  it('returns null marginPct when billed is zero', () => {
    const r = buildCustomerRevenueVsCostMonthly({
      jobs: [job({ id: 'j1' })],
      customers: [],
      arInvoices: [],
      apInvoices: [ap({ totalCents: 10_000_00 })],
      expenses: [],
    });
    expect(r.rows[0]?.marginPct).toBeNull();
  });

  it('counts unattributed when no matching job (AP/expense)', () => {
    const r = buildCustomerRevenueVsCostMonthly({
      jobs: [job({ id: 'j1' })],
      customers: [],
      arInvoices: [],
      apInvoices: [ap({ jobId: 'orphan' })],
      expenses: [],
    });
    expect(r.rollup.unattributed).toBe(1);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildCustomerRevenueVsCostMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      jobs: [job({ id: 'j1' })],
      customers: [],
      arInvoices: [
        ar({ id: 'old', invoiceDate: '2026-03-15' }),
        ar({ id: 'in', invoiceDate: '2026-04-15' }),
      ],
      apInvoices: [],
      expenses: [],
    });
    expect(r.rollup.billedCents).toBe(100_000_00);
  });

  it('sorts by customerName asc, month asc', () => {
    const r = buildCustomerRevenueVsCostMonthly({
      jobs: [
        job({ id: 'jA', ownerAgency: 'A Agency' }),
        job({ id: 'jZ', ownerAgency: 'Z Agency' }),
      ],
      customers: [],
      arInvoices: [
        ar({ id: 'a', jobId: 'jZ', customerName: 'Z Agency', invoiceDate: '2026-04-15' }),
        ar({ id: 'b', jobId: 'jA', customerName: 'A Agency', invoiceDate: '2026-05-01' }),
        ar({ id: 'c', jobId: 'jA', customerName: 'A Agency', invoiceDate: '2026-04-15' }),
      ],
      apInvoices: [],
      expenses: [],
    });
    expect(r.rows[0]?.customerName).toBe('A Agency');
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[2]?.customerName).toBe('Z Agency');
  });

  it('handles empty input', () => {
    const r = buildCustomerRevenueVsCostMonthly({
      jobs: [],
      customers: [],
      arInvoices: [],
      apInvoices: [],
      expenses: [],
    });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.marginCents).toBe(0);
  });
});
