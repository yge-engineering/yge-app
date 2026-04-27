import { describe, expect, it } from 'vitest';
import {
  buildJobProfitRows,
  computeJobProfitRollup,
  sortJobProfitRowsBleedersFirst,
} from './job-profit';
import type { ApInvoice } from './ap-invoice';
import type { ArInvoice } from './ar-invoice';
import type { ChangeOrder } from './change-order';
import type { Expense } from './expense';
import type { Job } from './job';
import type { MileageEntry } from './mileage';

function job(over: Partial<Job>): Job {
  return {
    id: 'job-2026-01-01-x-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    projectName: 'Sulphur Springs',
    projectType: 'ROAD_RECONSTRUCTION',
    contractType: 'PUBLIC_WORKS',
    status: 'AWARDED',
    ...over,
  } as Job;
}

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    jobId: 'job-2026-01-01-x-aaaaaaaa',
    invoiceNumber: '1',
    customerName: 'Cal Fire',
    invoiceDate: '2026-04-01',
    source: 'MANUAL',
    lineItems: [],
    subtotalCents: 0,
    totalCents: 50_000_00,
    paidCents: 0,
    status: 'SENT',
    ...over,
  };
}

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'api-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    vendorName: 'Acme',
    invoiceDate: '2026-04-01',
    totalCents: 10_000_00,
    paidCents: 0,
    status: 'APPROVED',
    lineItems: [],
    jobId: 'job-2026-01-01-x-aaaaaaaa',
    ...over,
  } as ApInvoice;
}

describe('buildJobProfitRows', () => {
  it('rolls revenue, AP, expense, mileage into a single row', () => {
    const rows = buildJobProfitRows({
      jobs: [job({ id: 'job-A' })],
      arInvoices: [
        ar({ id: 'ar-1', jobId: 'job-A', totalCents: 100_000_00, status: 'SENT' }),
      ],
      apInvoices: [
        ap({ id: 'api-1', jobId: 'job-A', totalCents: 30_000_00, status: 'APPROVED' }),
        ap({ id: 'api-2', jobId: 'job-A', totalCents: 5_000_00, status: 'PAID' }),
      ],
      changeOrders: [],
      expenses: [
        {
          id: 'exp-1',
          createdAt: '',
          updatedAt: '',
          employeeId: 'emp-1',
          employeeName: 'Jane',
          receiptDate: '2026-04-15',
          vendor: 'Holiday Inn',
          description: 'Lodging',
          amountCents: 1_000_00,
          category: 'LODGING',
          jobId: 'job-A',
          paidWithCompanyCard: false,
          reimbursed: false,
        } as Expense,
      ],
      mileage: [
        {
          id: 'mi-1',
          createdAt: '',
          updatedAt: '',
          employeeId: 'emp-1',
          employeeName: 'Jane',
          tripDate: '2026-04-15',
          vehicleDescription: 'Personal Tacoma',
          isPersonalVehicle: true,
          businessMiles: 100,
          purpose: 'JOBSITE_TRAVEL',
          irsRateCentsPerMile: 67,
          jobId: 'job-A',
          reimbursed: false,
        } as MileageEntry,
      ],
    });
    expect(rows).toHaveLength(1);
    const r = rows[0]!;
    expect(r.revenueBilledCents).toBe(100_000_00);
    expect(r.costsByCategory.apCents).toBe(35_000_00);
    expect(r.costsByCategory.expenseCents).toBe(1_000_00);
    expect(r.costsByCategory.mileageCents).toBe(67_00);
    expect(r.totalCostsCents).toBe(36_067_00);
    expect(r.grossProfitCents).toBe(63_933_00);
    expect(r.grossMargin).toBeCloseTo(0.63933, 4);
  });

  it('skips DRAFT AR + non-approved/non-paid AP', () => {
    const rows = buildJobProfitRows({
      jobs: [job({ id: 'job-A' })],
      arInvoices: [
        ar({ id: 'ar-1', jobId: 'job-A', totalCents: 50_000_00, status: 'DRAFT' }),
        ar({ id: 'ar-2', jobId: 'job-A', totalCents: 25_000_00, status: 'SENT' }),
      ],
      apInvoices: [
        ap({ id: 'api-1', jobId: 'job-A', totalCents: 10_000_00, status: 'DRAFT' }),
        ap({ id: 'api-2', jobId: 'job-A', totalCents: 8_000_00, status: 'PENDING' }),
        ap({ id: 'api-3', jobId: 'job-A', totalCents: 5_000_00, status: 'REJECTED' }),
        ap({ id: 'api-4', jobId: 'job-A', totalCents: 3_000_00, status: 'APPROVED' }),
      ],
      changeOrders: [],
    });
    const r = rows[0]!;
    expect(r.revenueBilledCents).toBe(25_000_00);
    expect(r.costsByCategory.apCents).toBe(3_000_00);
  });

  it('skips jobs with no activity at all', () => {
    const rows = buildJobProfitRows({
      jobs: [job({ id: 'job-A' }), job({ id: 'job-B' })],
      arInvoices: [ar({ jobId: 'job-A' })],
      apInvoices: [],
      changeOrders: [],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.jobId).toBe('job-A');
  });

  it('only counts approved + executed change orders in CO total', () => {
    const rows = buildJobProfitRows({
      jobs: [job({ id: 'job-A' })],
      arInvoices: [ar({ jobId: 'job-A' })],
      apInvoices: [],
      changeOrders: [
        {
          id: 'co-1',
          createdAt: '',
          updatedAt: '',
          jobId: 'job-A',
          changeOrderNumber: '1',
          subject: 'Extra rock',
          description: '',
          reason: 'OWNER_DIRECTED',
          status: 'APPROVED',
          lineItems: [],
          totalCostImpactCents: 5_000_00,
          totalScheduleImpactDays: 0,
        } as ChangeOrder,
        {
          id: 'co-2',
          createdAt: '',
          updatedAt: '',
          jobId: 'job-A',
          changeOrderNumber: '2',
          subject: 'Pending CO',
          description: '',
          reason: 'OWNER_DIRECTED',
          status: 'PROPOSED',
          lineItems: [],
          totalCostImpactCents: 99_999_00,
          totalScheduleImpactDays: 0,
        } as ChangeOrder,
      ],
    });
    expect(rows[0]?.changeOrderTotalCents).toBe(5_000_00);
  });

  it('grossMargin returns 0 when revenue is 0 (avoids divide-by-zero)', () => {
    const rows = buildJobProfitRows({
      jobs: [job({ id: 'job-A' })],
      arInvoices: [],
      apInvoices: [ap({ id: 'api-1', jobId: 'job-A', totalCents: 5_000_00 })],
      changeOrders: [],
    });
    expect(rows[0]?.grossMargin).toBe(0);
    expect(rows[0]?.grossProfitCents).toBe(-5_000_00);
  });
});

describe('sortJobProfitRowsBleedersFirst', () => {
  it('sorts ascending by gross profit (most-negative first)', () => {
    const rows = buildJobProfitRows({
      jobs: [job({ id: 'job-A' }), job({ id: 'job-B' })],
      arInvoices: [
        ar({ id: 'ar-A', jobId: 'job-A', totalCents: 10_000_00 }),
        ar({ id: 'ar-B', jobId: 'job-B', totalCents: 50_000_00 }),
      ],
      apInvoices: [
        ap({ id: 'api-A', jobId: 'job-A', totalCents: 20_000_00 }),
        ap({ id: 'api-B', jobId: 'job-B', totalCents: 30_000_00 }),
      ],
      changeOrders: [],
    });
    const sorted = sortJobProfitRowsBleedersFirst(rows);
    // Job A bleeds (-10k), Job B is healthy (+20k)
    expect(sorted[0]?.jobId).toBe('job-A');
    expect(sorted[1]?.jobId).toBe('job-B');
  });
});

describe('computeJobProfitRollup', () => {
  it('counts unprofitable jobs and computes blended margin', () => {
    const rows = buildJobProfitRows({
      jobs: [job({ id: 'job-A' }), job({ id: 'job-B' })],
      arInvoices: [
        ar({ id: 'ar-A', jobId: 'job-A', totalCents: 100_000_00 }),
        ar({ id: 'ar-B', jobId: 'job-B', totalCents: 50_000_00 }),
      ],
      apInvoices: [
        ap({ id: 'api-A', jobId: 'job-A', totalCents: 60_000_00 }),
        ap({ id: 'api-B', jobId: 'job-B', totalCents: 60_000_00 }),
      ],
      changeOrders: [],
    });
    const r = computeJobProfitRollup(rows);
    expect(r.jobs).toBe(2);
    expect(r.totalRevenueCents).toBe(150_000_00);
    expect(r.totalCostsCents).toBe(120_000_00);
    expect(r.totalGrossProfitCents).toBe(30_000_00);
    expect(r.blendedMargin).toBeCloseTo(0.2, 4);
    // Job B bleeds.
    expect(r.unprofitableJobs).toBe(1);
  });
});
