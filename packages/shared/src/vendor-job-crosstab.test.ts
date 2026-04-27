import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Vendor } from './vendor';

import { buildVendorJobCrosstab } from './vendor-job-crosstab';

function vendor(over: Partial<Vendor>): Vendor {
  return {
    id: 'vnd-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    legalName: 'Acme Trucking LLC',
    kind: 'TRUCKING',
    w9OnFile: false,
    is1099Reportable: true,
    coiOnFile: false,
    paymentTerms: 'NET_30',
    onHold: false,
    ...over,
  } as Vendor;
}

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    vendorName: 'Acme Trucking LLC',
    invoiceDate: '2026-04-01',
    jobId: 'job-1',
    lineItems: [],
    totalCents: 10_000_00,
    paidCents: 10_000_00,
    status: 'PAID',
    ...over,
  } as ApInvoice;
}

describe('buildVendorJobCrosstab', () => {
  it('groups AP spend per vendor per job', () => {
    const r = buildVendorJobCrosstab({
      vendors: [vendor({ id: 'v-acme', legalName: 'Acme Trucking LLC' })],
      apInvoices: [
        ap({ id: 'ap-1', jobId: 'job-A', totalCents: 10_000_00 }),
        ap({ id: 'ap-2', jobId: 'job-A', totalCents: 5_000_00 }),
        ap({ id: 'ap-3', jobId: 'job-B', totalCents: 3_000_00 }),
      ],
    });
    expect(r.rows[0]?.jobCount).toBe(2);
    expect(r.rows[0]?.totalSpendCents).toBe(18_000_00);
    expect(r.rows[0]?.jobs[0]?.jobId).toBe('job-A');
    expect(r.rows[0]?.jobs[0]?.totalCents).toBe(15_000_00);
  });

  it('skips DRAFT and REJECTED invoices', () => {
    const r = buildVendorJobCrosstab({
      vendors: [vendor({})],
      apInvoices: [
        ap({ id: 'ap-1', status: 'DRAFT', totalCents: 99_000_00 }),
        ap({ id: 'ap-2', status: 'REJECTED', totalCents: 99_000_00 }),
        ap({ id: 'ap-3', totalCents: 100_00 }),
      ],
    });
    expect(r.rows[0]?.totalSpendCents).toBe(100_00);
  });

  it('skips invoices with no jobId', () => {
    const r = buildVendorJobCrosstab({
      vendors: [vendor({})],
      apInvoices: [ap({ jobId: undefined, totalCents: 99_000_00 })],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('respects window bounds', () => {
    const r = buildVendorJobCrosstab({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      vendors: [vendor({})],
      apInvoices: [
        ap({ id: 'ap-old', invoiceDate: '2026-03-15' }),
        ap({ id: 'ap-in', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.totalSpendCents).toBe(10_000_00);
  });

  it('flags multi-job vendors (>=3 jobs)', () => {
    const r = buildVendorJobCrosstab({
      vendors: [vendor({})],
      apInvoices: [
        ap({ id: 'ap-1', jobId: 'job-A' }),
        ap({ id: 'ap-2', jobId: 'job-B' }),
        ap({ id: 'ap-3', jobId: 'job-C' }),
      ],
    });
    expect(r.rows[0]?.multiJobVendor).toBe(true);
    expect(r.rollup.multiJobVendors).toBe(1);
  });

  it('does not flag multi-job for vendors on fewer than 3 jobs', () => {
    const r = buildVendorJobCrosstab({
      vendors: [vendor({})],
      apInvoices: [
        ap({ id: 'ap-1', jobId: 'job-A' }),
        ap({ id: 'ap-2', jobId: 'job-B' }),
      ],
    });
    expect(r.rows[0]?.multiJobVendor).toBe(false);
    expect(r.rollup.multiJobVendors).toBe(0);
  });

  it('computes top-job share', () => {
    const r = buildVendorJobCrosstab({
      vendors: [vendor({})],
      apInvoices: [
        ap({ id: 'ap-1', jobId: 'job-big', totalCents: 80_000_00 }),
        ap({ id: 'ap-2', jobId: 'job-small', totalCents: 20_000_00 }),
      ],
    });
    expect(r.rows[0]?.topJobSharePct).toBe(0.8);
  });

  it('respects minJobs filter', () => {
    const r = buildVendorJobCrosstab({
      minJobs: 2,
      vendors: [
        vendor({ id: 'v-multi', legalName: 'Multi Vendor' }),
        vendor({ id: 'v-once', legalName: 'Once Vendor' }),
      ],
      apInvoices: [
        ap({ id: 'ap-1', vendorName: 'Multi Vendor', jobId: 'job-A' }),
        ap({ id: 'ap-2', vendorName: 'Multi Vendor', jobId: 'job-B' }),
        ap({ id: 'ap-3', vendorName: 'Once Vendor', jobId: 'job-C' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.vendorName).toBe('Multi Vendor');
  });

  it('matches AP to vendor by DBA name', () => {
    const r = buildVendorJobCrosstab({
      vendors: [
        vendor({ id: 'v-7', legalName: 'Big Construction LLC', dbaName: 'BigCo' }),
      ],
      apInvoices: [ap({ vendorName: 'BigCo' })],
    });
    expect(r.rows[0]?.vendorId).toBe('v-7');
  });

  it('rolls up distinct jobs across the input', () => {
    const r = buildVendorJobCrosstab({
      vendors: [vendor({})],
      apInvoices: [
        ap({ id: 'ap-1', jobId: 'job-A' }),
        ap({ id: 'ap-2', jobId: 'job-B' }),
        ap({ id: 'ap-3', jobId: 'job-A' }),
      ],
    });
    expect(r.rollup.jobsConsidered).toBe(2);
  });

  it('sorts vendors by total spend desc', () => {
    const r = buildVendorJobCrosstab({
      vendors: [
        vendor({ id: 'v-small', legalName: 'Small' }),
        vendor({ id: 'v-big', legalName: 'Big' }),
      ],
      apInvoices: [
        ap({ id: 'ap-s', vendorName: 'Small', jobId: 'j1', totalCents: 1_000_00 }),
        ap({ id: 'ap-b', vendorName: 'Big', jobId: 'j1', totalCents: 50_000_00 }),
      ],
    });
    expect(r.rows[0]?.vendorName).toBe('Big');
  });
});
