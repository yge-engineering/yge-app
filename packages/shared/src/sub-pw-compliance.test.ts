import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Job } from './job';
import type { Vendor } from './vendor';

import { buildSubPwCompliance } from './sub-pw-compliance';

function job(over: Partial<Pick<Job, 'id' | 'contractType'>>): Pick<
  Job,
  'id' | 'contractType'
> {
  return {
    id: 'job-pw',
    contractType: 'PUBLIC_WORKS',
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
    cslbLicense: '999999',
    dirRegistration: '1000123456',
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
    vendorName: 'Acme Subs LLC',
    invoiceDate: '2026-04-01',
    jobId: 'job-pw',
    lineItems: [],
    totalCents: 50_000_00,
    paidCents: 50_000_00,
    status: 'PAID',
    ...over,
  } as ApInvoice;
}

describe('buildSubPwCompliance', () => {
  it('drops compliant subs (both CSLB + DIR on file)', () => {
    const r = buildSubPwCompliance({
      jobs: [job({})],
      vendors: [vendor({})], // both fields populated by default
      apInvoices: [ap({})],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('flags NO_CSLB when CSLB missing but DIR present', () => {
    const r = buildSubPwCompliance({
      jobs: [job({})],
      vendors: [vendor({ cslbLicense: undefined })],
      apInvoices: [ap({})],
    });
    expect(r.rows[0]?.gap).toBe('NO_CSLB');
    expect(r.rollup.noCslbCount).toBe(1);
  });

  it('flags NO_DIR when DIR missing but CSLB present', () => {
    const r = buildSubPwCompliance({
      jobs: [job({})],
      vendors: [vendor({ dirRegistration: undefined })],
      apInvoices: [ap({})],
    });
    expect(r.rows[0]?.gap).toBe('NO_DIR');
  });

  it('flags BOTH_MISSING when neither on file', () => {
    const r = buildSubPwCompliance({
      jobs: [job({})],
      vendors: [vendor({ cslbLicense: undefined, dirRegistration: undefined })],
      apInvoices: [ap({})],
    });
    expect(r.rows[0]?.gap).toBe('BOTH_MISSING');
    expect(r.rollup.bothMissingCount).toBe(1);
  });

  it('treats empty/whitespace strings as missing', () => {
    const r = buildSubPwCompliance({
      jobs: [job({})],
      vendors: [vendor({ cslbLicense: '   ', dirRegistration: '' })],
      apInvoices: [ap({})],
    });
    expect(r.rows[0]?.gap).toBe('BOTH_MISSING');
  });

  it('only considers PUBLIC_WORKS jobs', () => {
    const r = buildSubPwCompliance({
      jobs: [
        job({ id: 'job-priv', contractType: 'PRIVATE' }),
      ],
      vendors: [vendor({ cslbLicense: undefined, dirRegistration: undefined })],
      apInvoices: [ap({ jobId: 'job-priv' })],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('only considers SUBCONTRACTOR vendors', () => {
    const r = buildSubPwCompliance({
      jobs: [job({})],
      vendors: [
        vendor({ kind: 'SUPPLIER', cslbLicense: undefined, dirRegistration: undefined }),
      ],
      apInvoices: [ap({})],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('skips DRAFT and REJECTED invoices', () => {
    const r = buildSubPwCompliance({
      jobs: [job({})],
      vendors: [vendor({ cslbLicense: undefined, dirRegistration: undefined })],
      apInvoices: [
        ap({ id: 'ap-1', status: 'DRAFT' }),
        ap({ id: 'ap-2', status: 'REJECTED' }),
      ],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('sums paid across multiple invoices and counts distinct jobs', () => {
    const r = buildSubPwCompliance({
      jobs: [
        job({ id: 'job-A' }),
        job({ id: 'job-B' }),
      ],
      vendors: [vendor({ cslbLicense: undefined, dirRegistration: undefined })],
      apInvoices: [
        ap({ id: 'ap-1', jobId: 'job-A', paidCents: 10_000_00 }),
        ap({ id: 'ap-2', jobId: 'job-A', paidCents: 5_000_00 }),
        ap({ id: 'ap-3', jobId: 'job-B', paidCents: 7_000_00 }),
      ],
    });
    expect(r.rows[0]?.paidOnPwCents).toBe(22_000_00);
    expect(r.rows[0]?.invoiceCount).toBe(3);
    expect(r.rows[0]?.jobIds).toHaveLength(2);
  });

  it('rolls up unsupportedPwCents across all flagged rows', () => {
    const r = buildSubPwCompliance({
      jobs: [job({})],
      vendors: [
        vendor({ id: 'v1', legalName: 'A', cslbLicense: undefined }),
        vendor({ id: 'v2', legalName: 'B', dirRegistration: undefined }),
      ],
      apInvoices: [
        ap({ id: 'ap-1', vendorName: 'A', paidCents: 10_000_00 }),
        ap({ id: 'ap-2', vendorName: 'B', paidCents: 20_000_00 }),
      ],
    });
    expect(r.rollup.unsupportedPwCents).toBe(30_000_00);
  });

  it('sorts BOTH_MISSING first, then by paid amount desc', () => {
    const r = buildSubPwCompliance({
      jobs: [job({})],
      vendors: [
        vendor({ id: 'v-no-cslb', legalName: 'NoCslb', cslbLicense: undefined }),
        vendor({ id: 'v-both', legalName: 'Both', cslbLicense: undefined, dirRegistration: undefined }),
        vendor({ id: 'v-no-dir', legalName: 'NoDir', dirRegistration: undefined }),
      ],
      apInvoices: [
        ap({ id: 'ap-1', vendorName: 'NoCslb', paidCents: 50_000_00 }),
        ap({ id: 'ap-2', vendorName: 'Both', paidCents: 10_000_00 }),
        ap({ id: 'ap-3', vendorName: 'NoDir', paidCents: 30_000_00 }),
      ],
    });
    expect(r.rows[0]?.vendorId).toBe('v-both');
    expect(r.rows[1]?.vendorId).toBe('v-no-dir');
    expect(r.rows[2]?.vendorId).toBe('v-no-cslb');
  });
});
