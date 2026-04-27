import { describe, expect, it } from 'vitest';

import type { ArInvoice, ArInvoiceLineItem } from './ar-invoice';
import type { Job } from './job';

import { buildJobRevenueMix } from './job-revenue-mix';

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

function line(over: Partial<ArInvoiceLineItem>): ArInvoiceLineItem {
  return {
    kind: 'LABOR',
    description: 'Crew labor',
    quantity: 1,
    unitPriceCents: 0,
    lineTotalCents: 100_00,
    ...over,
  } as ArInvoiceLineItem;
}

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'job-1',
    invoiceNumber: '1',
    customerName: 'Cal Fire',
    invoiceDate: '2026-04-15',
    source: 'PROGRESS',
    lineItems: [],
    subtotalCents: 0,
    totalCents: 0,
    paidCents: 0,
    status: 'SENT',
    ...over,
  } as ArInvoice;
}

describe('buildJobRevenueMix', () => {
  it('rolls up line totals by kind', () => {
    const r = buildJobRevenueMix({
      jobs: [job({})],
      arInvoices: [
        ar({
          lineItems: [
            line({ kind: 'LABOR', lineTotalCents: 50_000_00 }),
            line({ kind: 'EQUIPMENT', lineTotalCents: 20_000_00 }),
            line({ kind: 'MATERIAL', lineTotalCents: 30_000_00 }),
          ],
        }),
      ],
    });
    expect(r.rows[0]?.laborCents).toBe(50_000_00);
    expect(r.rows[0]?.equipmentCents).toBe(20_000_00);
    expect(r.rows[0]?.materialCents).toBe(30_000_00);
    expect(r.rows[0]?.totalBilledCents).toBe(100_000_00);
  });

  it('identifies the top revenue source', () => {
    const r = buildJobRevenueMix({
      jobs: [job({})],
      arInvoices: [
        ar({
          lineItems: [
            line({ kind: 'LABOR', lineTotalCents: 30_000_00 }),
            line({ kind: 'SUBCONTRACT', lineTotalCents: 60_000_00 }),
          ],
        }),
      ],
    });
    expect(r.rows[0]?.topKind).toBe('SUBCONTRACT');
    // 60K / 90K = 0.6667
    expect(r.rows[0]?.topKindSharePct).toBeCloseTo(0.6667, 3);
  });

  it('flags concentrated when top share exceeds 70%', () => {
    const r = buildJobRevenueMix({
      jobs: [job({})],
      arInvoices: [
        ar({
          lineItems: [
            line({ kind: 'LABOR', lineTotalCents: 90_000_00 }),
            line({ kind: 'OTHER', lineTotalCents: 10_000_00 }),
          ],
        }),
      ],
    });
    expect(r.rows[0]?.concentrated).toBe(true);
    expect(r.rollup.concentratedJobs).toBe(1);
  });

  it('does not flag concentrated when top share is at-or-below 70%', () => {
    const r = buildJobRevenueMix({
      jobs: [job({})],
      arInvoices: [
        ar({
          lineItems: [
            line({ kind: 'LABOR', lineTotalCents: 70_000_00 }),
            line({ kind: 'EQUIPMENT', lineTotalCents: 30_000_00 }),
          ],
        }),
      ],
    });
    expect(r.rows[0]?.concentrated).toBe(false);
  });

  it('skips DRAFT and WRITTEN_OFF AR invoices', () => {
    const r = buildJobRevenueMix({
      jobs: [job({})],
      arInvoices: [
        ar({
          id: 'ar-draft',
          status: 'DRAFT',
          lineItems: [line({ kind: 'LABOR', lineTotalCents: 99_000_00 })],
        }),
        ar({
          id: 'ar-wo',
          status: 'WRITTEN_OFF',
          lineItems: [line({ kind: 'MATERIAL', lineTotalCents: 99_000_00 })],
        }),
      ],
    });
    expect(r.rows[0]?.totalBilledCents).toBe(0);
  });

  it('skips non-AWARDED jobs by default', () => {
    const r = buildJobRevenueMix({
      jobs: [
        job({ id: 'job-prosp', status: 'PROSPECT' }),
        job({ id: 'job-awd', status: 'AWARDED' }),
      ],
      arInvoices: [],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.jobId).toBe('job-awd');
  });

  it('returns null topKind when no billed revenue', () => {
    const r = buildJobRevenueMix({
      jobs: [job({})],
      arInvoices: [],
    });
    expect(r.rows[0]?.topKind).toBe(null);
    expect(r.rows[0]?.topKindSharePct).toBe(0);
  });

  it('rolls up grand totals by kind', () => {
    const r = buildJobRevenueMix({
      jobs: [job({ id: 'j1' }), job({ id: 'j2' })],
      arInvoices: [
        ar({ id: 'ar-1', jobId: 'j1', lineItems: [line({ kind: 'LABOR', lineTotalCents: 50_000_00 })] }),
        ar({ id: 'ar-2', jobId: 'j2', lineItems: [line({ kind: 'LABOR', lineTotalCents: 30_000_00 })] }),
        ar({ id: 'ar-3', jobId: 'j1', lineItems: [line({ kind: 'EQUIPMENT', lineTotalCents: 20_000_00 })] }),
      ],
    });
    expect(r.rollup.totalByKind.LABOR).toBe(80_000_00);
    expect(r.rollup.totalByKind.EQUIPMENT).toBe(20_000_00);
    expect(r.rollup.totalBilledCents).toBe(100_000_00);
  });

  it('sorts highest-billed job first', () => {
    const r = buildJobRevenueMix({
      jobs: [job({ id: 'j-small' }), job({ id: 'j-big' })],
      arInvoices: [
        ar({ id: 'ar-s', jobId: 'j-small', lineItems: [line({ lineTotalCents: 1_000_00 })] }),
        ar({ id: 'ar-b', jobId: 'j-big', lineItems: [line({ lineTotalCents: 50_000_00 })] }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('j-big');
  });
});
