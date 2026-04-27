import { describe, expect, it } from 'vitest';
import { buildSubScorecard } from './sub-scorecard';
import type { ApInvoice } from './ap-invoice';
import type { PunchItem } from './punch-list';
import type { Vendor } from './vendor';

function vendor(over: Partial<Vendor>): Vendor {
  return {
    id: 'v-1',
    createdAt: '',
    updatedAt: '',
    legalName: 'Acme Subs',
    kind: 'SUBCONTRACTOR',
    coiOnFile: true,
    coiExpiresOn: '2027-01-01',
    ...over,
  } as Vendor;
}

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'api-1',
    createdAt: '',
    updatedAt: '',
    vendorName: 'Acme Subs',
    invoiceDate: '2026-04-01',
    totalCents: 100_00,
    paidCents: 0,
    status: 'APPROVED',
    lineItems: [],
    ...over,
  } as ApInvoice;
}

function pi(over: Partial<PunchItem>): PunchItem {
  return {
    id: 'pi-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'job-1',
    identifiedOn: '2026-04-01',
    location: 'somewhere',
    description: 'something',
    severity: 'MINOR',
    status: 'OPEN',
    ...over,
  } as PunchItem;
}

describe('buildSubScorecard', () => {
  it('rolls up AP spend per sub by vendorName match', () => {
    const r = buildSubScorecard({
      asOf: '2026-04-27',
      vendors: [vendor({ id: 'v-acme', legalName: 'Acme Subs' })],
      apInvoices: [
        ap({ id: '1', vendorName: 'Acme Subs', totalCents: 1_000_00, paidCents: 500_00, jobId: 'job-A' }),
        ap({ id: '2', vendorName: 'Acme Subs', totalCents: 2_000_00, paidCents: 0, jobId: 'job-B' }),
      ],
      punchItems: [],
    });
    const row = r.rows[0]!;
    expect(row.vendorId).toBe('v-acme');
    expect(row.totalSpendCents).toBe(3_000_00);
    expect(row.totalPaidCents).toBe(500_00);
    expect(row.invoiceCount).toBe(2);
    expect(row.jobCount).toBe(2);
  });

  it('only considers vendors with kind=SUBCONTRACTOR', () => {
    const r = buildSubScorecard({
      asOf: '2026-04-27',
      vendors: [
        vendor({ id: 'v-sub', kind: 'SUBCONTRACTOR', legalName: 'Sub Co' }),
        vendor({ id: 'v-supp', kind: 'SUPPLIER', legalName: 'Granite Rock' }),
      ],
      apInvoices: [
        ap({ id: '1', vendorName: 'Sub Co', totalCents: 100_00 }),
        ap({ id: '2', vendorName: 'Granite Rock', totalCents: 99_999_00 }),
      ],
      punchItems: [],
    });
    expect(r.rows.map((x) => x.vendorId)).toEqual(['v-sub']);
  });

  it('skips DRAFT + REJECTED AP invoices', () => {
    const r = buildSubScorecard({
      asOf: '2026-04-27',
      vendors: [vendor({ id: 'v-1' })],
      apInvoices: [
        ap({ id: 'd', status: 'DRAFT', totalCents: 99_999_00 }),
        ap({ id: 'r', status: 'REJECTED', totalCents: 99_999_00 }),
        ap({ id: 'a', status: 'APPROVED', totalCents: 100_00 }),
      ],
      punchItems: [],
    });
    expect(r.rows[0]?.totalSpendCents).toBe(100_00);
  });

  it('counts open vs closed punch items by responsibleVendorId', () => {
    const r = buildSubScorecard({
      asOf: '2026-04-27',
      vendors: [vendor({ id: 'v-1' })],
      apInvoices: [ap({ id: 'a', jobId: 'job-A' })],
      punchItems: [
        pi({ id: 'p1', responsibleVendorId: 'v-1', status: 'OPEN' }),
        pi({ id: 'p2', responsibleVendorId: 'v-1', status: 'IN_PROGRESS' }),
        pi({ id: 'p3', responsibleVendorId: 'v-1', status: 'DISPUTED' }),
        pi({ id: 'p4', responsibleVendorId: 'v-1', status: 'CLOSED' }),
        pi({ id: 'p5', responsibleVendorId: 'v-1', status: 'WAIVED' }),
      ],
    });
    const row = r.rows[0]!;
    expect(row.openPunchItems).toBe(3);
    expect(row.closedPunchItems).toBe(2);
    expect(row.totalPunchItems).toBe(5);
  });

  it('matches punch items by responsibleParty name when vendorId missing', () => {
    const r = buildSubScorecard({
      asOf: '2026-04-27',
      vendors: [vendor({ id: 'v-acme', legalName: 'Acme Subs' })],
      apInvoices: [ap({ id: 'a', vendorName: 'Acme Subs', jobId: 'job-A' })],
      punchItems: [
        pi({ id: 'p1', responsibleParty: 'Acme Subs LLC', status: 'OPEN' }),
        pi({ id: 'p2', responsibleParty: 'Unknown Crew', status: 'OPEN' }),
      ],
    });
    const row = r.rows[0]!;
    expect(row.openPunchItems).toBe(1); // p1 matched, p2 didn't
  });

  it('callbacksPerJob = total punch / distinct jobs', () => {
    const r = buildSubScorecard({
      asOf: '2026-04-27',
      vendors: [vendor({ id: 'v-1' })],
      apInvoices: [
        ap({ id: 'a', jobId: 'job-A' }),
        ap({ id: 'b', jobId: 'job-B' }),
      ],
      punchItems: [
        pi({ id: 'p1', responsibleVendorId: 'v-1', status: 'OPEN' }),
        pi({ id: 'p2', responsibleVendorId: 'v-1', status: 'CLOSED' }),
        pi({ id: 'p3', responsibleVendorId: 'v-1', status: 'CLOSED' }),
      ],
    });
    expect(r.rows[0]?.callbacksPerJob).toBe(1.5);
  });

  it('coiCurrent reflects vendor.coi state at asOf', () => {
    const r = buildSubScorecard({
      asOf: '2026-04-27',
      vendors: [
        vendor({ id: 'v-good', legalName: 'Good Sub', coiOnFile: true, coiExpiresOn: '2027-01-01' }),
        vendor({ id: 'v-bad', legalName: 'Bad Sub', coiOnFile: true, coiExpiresOn: '2026-01-01' }),
        vendor({ id: 'v-none', legalName: 'No Sub', coiOnFile: false }),
      ],
      apInvoices: [
        ap({ id: '1', vendorName: 'Good Sub' }),
        ap({ id: '2', vendorName: 'Bad Sub' }),
        ap({ id: '3', vendorName: 'No Sub' }),
      ],
      punchItems: [],
    });
    const byId = new Map(r.rows.map((x) => [x.vendorId, x]));
    expect(byId.get('v-good')?.coiCurrent).toBe(true);
    expect(byId.get('v-bad')?.coiCurrent).toBe(false);
    expect(byId.get('v-none')?.coiCurrent).toBe(false);
  });

  it('rollup: subCount + coiCurrentRate + top5Share', () => {
    const r = buildSubScorecard({
      asOf: '2026-04-27',
      vendors: [
        vendor({ id: 'a', legalName: 'A' }),
        vendor({ id: 'b', legalName: 'B', coiOnFile: false }),
        vendor({ id: 'c', legalName: 'C' }),
      ],
      apInvoices: [
        ap({ id: '1', vendorName: 'A', totalCents: 500_00 }),
        ap({ id: '2', vendorName: 'B', totalCents: 300_00 }),
        ap({ id: '3', vendorName: 'C', totalCents: 200_00 }),
      ],
      punchItems: [],
    });
    expect(r.rollup.subCount).toBe(3);
    expect(r.rollup.totalSpendCents).toBe(1_000_00);
    expect(r.rollup.coiCurrentRate).toBeCloseTo(2 / 3, 4); // a + c
    expect(r.rollup.top5SharePct).toBe(1); // ≤5 vendors → 100%
  });

  it('skips subs with no AP and no punch items', () => {
    const r = buildSubScorecard({
      asOf: '2026-04-27',
      vendors: [vendor({ id: 'v-unused', legalName: 'Unused' })],
      apInvoices: [],
      punchItems: [],
    });
    expect(r.rows).toHaveLength(0);
  });
});
