import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Job } from './job';

import { buildCustomerApSpendMonthly } from './customer-ap-spend-monthly';

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

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    vendorName: 'Granite',
    invoiceDate: '2026-04-15',
    jobId: 'j1',
    lineItems: [],
    totalCents: 50_000_00,
    paidCents: 0,
    status: 'PENDING',
    ...over,
  } as ApInvoice;
}

describe('buildCustomerApSpendMonthly', () => {
  it('groups by (customer, month)', () => {
    const r = buildCustomerApSpendMonthly({
      jobs: [
        job({ id: 'j1', ownerAgency: 'Caltrans D2' }),
        job({ id: 'j2', ownerAgency: 'CAL FIRE' }),
      ],
      apInvoices: [
        ap({ id: 'a', jobId: 'j1', invoiceDate: '2026-04-15' }),
        ap({ id: 'b', jobId: 'j2', invoiceDate: '2026-04-15' }),
        ap({ id: 'c', jobId: 'j1', invoiceDate: '2026-05-01' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('sums totalCents + paidCents + openCents', () => {
    const r = buildCustomerApSpendMonthly({
      jobs: [job({ id: 'j1' })],
      apInvoices: [
        ap({ id: 'a', totalCents: 100_000_00, paidCents: 30_000_00 }),
        ap({ id: 'b', totalCents: 50_000_00, paidCents: 50_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalCents).toBe(150_000_00);
    expect(r.rows[0]?.paidCents).toBe(80_000_00);
    expect(r.rows[0]?.openCents).toBe(70_000_00);
  });

  it('counts distinct vendors + jobs', () => {
    const r = buildCustomerApSpendMonthly({
      jobs: [
        job({ id: 'j1', ownerAgency: 'Caltrans D2' }),
        job({ id: 'j2', ownerAgency: 'Caltrans D2' }),
      ],
      apInvoices: [
        ap({ id: 'a', vendorName: 'Granite', jobId: 'j1' }),
        ap({ id: 'b', vendorName: 'Granite, Inc', jobId: 'j2' }),
        ap({ id: 'c', vendorName: 'Bob Trucking', jobId: 'j1' }),
      ],
    });
    expect(r.rows[0]?.distinctVendors).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('counts unattributed (no jobId or no matching job)', () => {
    const r = buildCustomerApSpendMonthly({
      jobs: [job({ id: 'j1' })],
      apInvoices: [
        ap({ id: 'a', jobId: 'j1' }),
        ap({ id: 'b', jobId: undefined }),
        ap({ id: 'c', jobId: 'orphan' }),
      ],
    });
    expect(r.rollup.unattributed).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildCustomerApSpendMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      jobs: [job({ id: 'j1' })],
      apInvoices: [
        ap({ id: 'old', invoiceDate: '2026-03-15' }),
        ap({ id: 'in', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalInvoices).toBe(1);
  });

  it('sorts by customerName asc, month asc', () => {
    const r = buildCustomerApSpendMonthly({
      jobs: [
        job({ id: 'jA', ownerAgency: 'A Agency' }),
        job({ id: 'jZ', ownerAgency: 'Z Agency' }),
      ],
      apInvoices: [
        ap({ id: 'a', jobId: 'jZ', invoiceDate: '2026-04-15' }),
        ap({ id: 'b', jobId: 'jA', invoiceDate: '2026-05-01' }),
        ap({ id: 'c', jobId: 'jA', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('A Agency');
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[2]?.customerName).toBe('Z Agency');
  });

  it('handles empty input', () => {
    const r = buildCustomerApSpendMonthly({ jobs: [], apInvoices: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalCents).toBe(0);
  });
});
