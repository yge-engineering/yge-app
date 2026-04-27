import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Job } from './job';
import type { Vendor } from './vendor';

import { buildJobSubSpend } from './job-sub-spend';

function job(over: Partial<Pick<Job, 'id' | 'projectName' | 'status'>>): Pick<
  Job,
  'id' | 'projectName' | 'status'
> {
  return {
    id: 'job-1',
    projectName: 'Sulphur Springs',
    status: 'AWARDED',
    ...over,
  };
}

function vendor(over: Partial<Vendor>): Vendor {
  return {
    id: 'vnd-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    legalName: 'Acme Subs LLC',
    kind: 'SUBCONTRACTOR',
    w9OnFile: false,
    is1099Reportable: true,
    coiOnFile: true,
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
    vendorName: 'Acme Subs LLC',
    invoiceDate: '2026-04-01',
    jobId: 'job-1',
    lineItems: [],
    totalCents: 50_000_00,
    paidCents: 50_000_00,
    status: 'PAID',
    ...over,
  } as ApInvoice;
}

describe('buildJobSubSpend', () => {
  it('groups AP spend per sub on a job', () => {
    const r = buildJobSubSpend({
      jobs: [job({})],
      vendors: [
        vendor({ id: 'v-acme', legalName: 'Acme Subs LLC' }),
        vendor({ id: 'v-beta', legalName: 'Beta Trucking' }),
      ],
      apInvoices: [
        ap({ id: 'ap-1', vendorName: 'Acme Subs LLC', totalCents: 30_000_00 }),
        ap({ id: 'ap-2', vendorName: 'Acme Subs LLC', totalCents: 20_000_00 }),
        ap({ id: 'ap-3', vendorName: 'Beta Trucking', totalCents: 10_000_00 }),
      ],
    });
    expect(r.rows[0]?.subCount).toBe(2);
    expect(r.rows[0]?.totalSubSpendCents).toBe(60_000_00);
    expect(r.rows[0]?.subs[0]?.vendorId).toBe('v-acme');
    expect(r.rows[0]?.subs[0]?.totalCents).toBe(50_000_00);
  });

  it('only counts SUBCONTRACTOR vendors by default', () => {
    const r = buildJobSubSpend({
      jobs: [job({})],
      vendors: [
        vendor({ id: 'v-supplier', legalName: 'Material Supply', kind: 'SUPPLIER' }),
      ],
      apInvoices: [
        ap({ id: 'ap-1', vendorName: 'Material Supply', totalCents: 99_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalSubSpendCents).toBe(0);
  });

  it('counts every AP invoice when onlySubcontractorVendors=false', () => {
    const r = buildJobSubSpend({
      onlySubcontractorVendors: false,
      jobs: [job({})],
      vendors: [
        vendor({ id: 'v-supplier', legalName: 'Material Supply', kind: 'SUPPLIER' }),
      ],
      apInvoices: [
        ap({ id: 'ap-1', vendorName: 'Material Supply', totalCents: 99_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalSubSpendCents).toBe(99_000_00);
    expect(r.rows[0]?.attributedSubSpendCents).toBe(0);
    expect(r.rows[0]?.subs[0]?.isSubcontractor).toBe(false);
  });

  it('skips DRAFT and REJECTED invoices', () => {
    const r = buildJobSubSpend({
      jobs: [job({})],
      vendors: [vendor({})],
      apInvoices: [
        ap({ id: 'ap-1', status: 'DRAFT', totalCents: 99_000_00 }),
        ap({ id: 'ap-2', status: 'REJECTED', totalCents: 99_000_00 }),
        ap({ id: 'ap-3', status: 'PAID', totalCents: 100_00 }),
      ],
    });
    expect(r.rows[0]?.totalSubSpendCents).toBe(100_00);
  });

  it('skips AP invoices with no jobId', () => {
    const r = buildJobSubSpend({
      jobs: [job({})],
      vendors: [vendor({})],
      apInvoices: [
        ap({ id: 'ap-orphan', jobId: undefined, totalCents: 99_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalSubSpendCents).toBe(0);
  });

  it('computes top-sub share per job', () => {
    const r = buildJobSubSpend({
      jobs: [job({})],
      vendors: [
        vendor({ id: 'v1', legalName: 'V1' }),
        vendor({ id: 'v2', legalName: 'V2' }),
      ],
      apInvoices: [
        ap({ id: 'ap-1', vendorName: 'V1', totalCents: 80_000_00 }),
        ap({ id: 'ap-2', vendorName: 'V2', totalCents: 20_000_00 }),
      ],
    });
    expect(r.rows[0]?.topSub?.vendorId).toBe('v1');
    expect(r.rows[0]?.topSubSharePct).toBe(0.8);
  });

  it('skips non-AWARDED jobs by default', () => {
    const r = buildJobSubSpend({
      jobs: [
        job({ id: 'j-prosp', status: 'PROSPECT' }),
        job({ id: 'j-awd' }),
      ],
      vendors: [],
      apInvoices: [],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.jobId).toBe('j-awd');
  });

  it('matches AP invoices to vendor by DBA name', () => {
    const r = buildJobSubSpend({
      jobs: [job({})],
      vendors: [
        vendor({ id: 'v-7', legalName: 'Big Construction LLC', dbaName: 'BigCo' }),
      ],
      apInvoices: [ap({ vendorName: 'BigCo', totalCents: 50_000_00 })],
    });
    expect(r.rows[0]?.subs[0]?.vendorId).toBe('v-7');
  });

  it('rolls up grand totals across jobs', () => {
    const r = buildJobSubSpend({
      jobs: [job({ id: 'j1' }), job({ id: 'j2' })],
      vendors: [vendor({ legalName: 'Acme Subs LLC' })],
      apInvoices: [
        ap({ id: 'ap-1', jobId: 'j1', totalCents: 10_000_00 }),
        ap({ id: 'ap-2', jobId: 'j2', totalCents: 30_000_00 }),
      ],
    });
    expect(r.rollup.totalSubSpendCents).toBe(40_000_00);
    expect(r.rollup.totalAttributedSubSpendCents).toBe(40_000_00);
  });

  it('sorts by total sub spend desc', () => {
    const r = buildJobSubSpend({
      jobs: [job({ id: 'j-small' }), job({ id: 'j-big' })],
      vendors: [vendor({})],
      apInvoices: [
        ap({ id: 'ap-1', jobId: 'j-small', totalCents: 1_000_00 }),
        ap({ id: 'ap-2', jobId: 'j-big', totalCents: 50_000_00 }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('j-big');
  });
});
