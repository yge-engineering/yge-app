import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Job } from './job';
import type { SubBid } from './sub-bid';
import type { Vendor } from './vendor';

import { buildJobSubBidVariance } from './job-sub-bid-variance';

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
    id: 'vnd-acme',
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

function subBid(over: Partial<SubBid>): SubBid {
  return {
    id: 'sb-1',
    contractorName: 'Acme Subs LLC',
    portionOfWork: 'Site grading',
    bidAmountCents: 50_000_00,
    ...over,
  } as SubBid;
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

describe('buildJobSubBidVariance', () => {
  it('matches listed sub to actual AP spend', () => {
    const r = buildJobSubBidVariance({
      jobs: [job({})],
      subBidsByJobId: new Map([['job-1', [subBid({ bidAmountCents: 50_000_00 })]]]),
      vendors: [vendor({})],
      apInvoices: [ap({ totalCents: 52_000_00 })],
    });
    const row = r.jobs[0]?.rows[0];
    expect(row?.kind).toBe('MATCHED');
    expect(row?.varianceCents).toBe(2_000_00);
    expect(row?.variancePct).toBe(0.04);
  });

  it('flags LISTED_NO_SPEND when listed sub has no AP', () => {
    const r = buildJobSubBidVariance({
      jobs: [job({})],
      subBidsByJobId: new Map([['job-1', [subBid({})]]]),
      vendors: [vendor({})],
      apInvoices: [],
    });
    expect(r.jobs[0]?.rows[0]?.kind).toBe('LISTED_NO_SPEND');
    expect(r.jobs[0]?.listedNoSpendCount).toBe(1);
  });

  it('flags UNLISTED_WITH_SPEND when AP exists for an unlisted sub', () => {
    const r = buildJobSubBidVariance({
      jobs: [job({})],
      subBidsByJobId: new Map([['job-1', []]]),
      vendors: [vendor({ legalName: 'Surprise Sub LLC' })],
      apInvoices: [
        ap({ vendorName: 'Surprise Sub LLC', totalCents: 30_000_00 }),
      ],
    });
    expect(r.jobs[0]?.rows[0]?.kind).toBe('UNLISTED_WITH_SPEND');
    expect(r.jobs[0]?.unlistedWithSpendCount).toBe(1);
  });

  it('skips DRAFT and REJECTED AP invoices', () => {
    const r = buildJobSubBidVariance({
      jobs: [job({})],
      subBidsByJobId: new Map([['job-1', [subBid({})]]]),
      vendors: [vendor({})],
      apInvoices: [
        ap({ id: 'd', status: 'DRAFT' }),
        ap({ id: 'r', status: 'REJECTED' }),
      ],
    });
    expect(r.jobs[0]?.rows[0]?.kind).toBe('LISTED_NO_SPEND');
  });

  it('matches AP to vendor by DBA name in either direction', () => {
    const r = buildJobSubBidVariance({
      jobs: [job({})],
      subBidsByJobId: new Map([['job-1', [subBid({ contractorName: 'BigCo' })]]]),
      vendors: [vendor({ legalName: 'Big Construction LLC', dbaName: 'BigCo' })],
      apInvoices: [ap({ vendorName: 'Big Construction LLC', totalCents: 60_000_00 })],
    });
    expect(r.jobs[0]?.rows[0]?.kind).toBe('MATCHED');
  });

  it('skips non-AWARDED jobs by default', () => {
    const r = buildJobSubBidVariance({
      jobs: [
        job({ id: 'j-prosp', status: 'PROSPECT' }),
        job({ id: 'j-awd' }),
      ],
      subBidsByJobId: new Map(),
      vendors: [],
      apInvoices: [],
    });
    expect(r.jobs).toHaveLength(1);
    expect(r.jobs[0]?.jobId).toBe('j-awd');
  });

  it('totals listed bid + actual + variance per job', () => {
    const r = buildJobSubBidVariance({
      jobs: [job({})],
      subBidsByJobId: new Map([
        ['job-1', [
          subBid({ id: 'a', contractorName: 'Acme Subs LLC', bidAmountCents: 50_000_00 }),
          subBid({ id: 'b', contractorName: 'Beta Co', bidAmountCents: 30_000_00 }),
        ]],
      ]),
      vendors: [
        vendor({ id: 'v-acme', legalName: 'Acme Subs LLC' }),
        vendor({ id: 'v-beta', legalName: 'Beta Co' }),
      ],
      apInvoices: [
        ap({ id: 'a-ap', vendorName: 'Acme Subs LLC', totalCents: 60_000_00 }),
        ap({ id: 'b-ap', vendorName: 'Beta Co', totalCents: 25_000_00 }),
      ],
    });
    expect(r.jobs[0]?.totalListedBidCents).toBe(80_000_00);
    expect(r.jobs[0]?.totalActualSpendCents).toBe(85_000_00);
    expect(r.jobs[0]?.totalVarianceCents).toBe(5_000_00);
  });

  it('rolls up unlisted + listed-no-spend totals across jobs', () => {
    const r = buildJobSubBidVariance({
      jobs: [job({ id: 'j1' }), job({ id: 'j2' })],
      subBidsByJobId: new Map([
        ['j1', [subBid({})]],
        ['j2', []],
      ]),
      vendors: [vendor({ legalName: 'Surprise Sub LLC' })],
      apInvoices: [
        ap({ id: 'a', jobId: 'j2', vendorName: 'Surprise Sub LLC' }),
      ],
    });
    expect(r.rollup.totalListedNoSpend).toBe(1);
    expect(r.rollup.totalUnlistedWithSpend).toBe(1);
  });

  it('sorts UNLISTED_WITH_SPEND rows first within a job', () => {
    const r = buildJobSubBidVariance({
      jobs: [job({})],
      subBidsByJobId: new Map([
        ['job-1', [subBid({ id: 'a', contractorName: 'Acme Subs LLC' })]],
      ]),
      vendors: [
        vendor({ id: 'v-acme', legalName: 'Acme Subs LLC' }),
        vendor({ id: 'v-surprise', legalName: 'Surprise LLC' }),
      ],
      apInvoices: [
        ap({ id: 'a1', vendorName: 'Acme Subs LLC', totalCents: 50_000_00 }),
        ap({ id: 's1', vendorName: 'Surprise LLC', totalCents: 30_000_00 }),
      ],
    });
    expect(r.jobs[0]?.rows[0]?.kind).toBe('UNLISTED_WITH_SPEND');
    expect(r.jobs[0]?.rows[1]?.kind).toBe('MATCHED');
  });

  it('sorts jobs by absolute total variance desc', () => {
    const r = buildJobSubBidVariance({
      jobs: [job({ id: 'j-clean' }), job({ id: 'j-over' })],
      subBidsByJobId: new Map([
        ['j-clean', [subBid({ contractorName: 'Acme Subs LLC', bidAmountCents: 50_000_00 })]],
        ['j-over', [subBid({ contractorName: 'Acme Subs LLC', bidAmountCents: 50_000_00 })]],
      ]),
      vendors: [vendor({})],
      apInvoices: [
        ap({ id: 'c', jobId: 'j-clean', totalCents: 50_000_00 }),
        ap({ id: 'o', jobId: 'j-over', totalCents: 100_000_00 }),
      ],
    });
    expect(r.jobs[0]?.jobId).toBe('j-over');
  });
});
