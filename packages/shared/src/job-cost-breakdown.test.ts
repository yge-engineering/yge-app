import { describe, expect, it } from 'vitest';
import { UNCODED_BUCKET, buildJobCostBreakdown } from './job-cost-breakdown';
import type { ApInvoice, ApInvoiceLineItem } from './ap-invoice';
import type { DirClassification } from './employee';
import type { Expense } from './expense';
import type { MileageEntry } from './mileage';
import type { TimeCard, TimeEntry } from './time-card';

function ap(over: Partial<ApInvoice>, lines: Partial<ApInvoiceLineItem>[] = []): ApInvoice {
  return {
    id: 'api-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    vendorName: 'Acme',
    invoiceDate: '2026-04-01',
    totalCents: 0,
    paidCents: 0,
    status: 'APPROVED',
    lineItems: lines.map(
      (l) =>
        ({
          description: 'line',
          quantity: 1,
          unitPriceCents: 0,
          lineTotalCents: 0,
          ...l,
        }) as ApInvoiceLineItem,
    ),
    ...over,
  } as ApInvoice;
}

function exp(over: Partial<Expense>): Expense {
  return {
    id: 'exp-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    employeeId: 'emp-1',
    employeeName: 'Jane',
    receiptDate: '2026-04-15',
    vendor: 'Holiday Inn',
    description: 'Lodging',
    amountCents: 0,
    category: 'LODGING',
    paidWithCompanyCard: false,
    reimbursed: false,
    ...over,
  } as Expense;
}

function entry(over: Partial<TimeEntry>): TimeEntry {
  return {
    date: '2026-04-15',
    jobId: 'job-A',
    startTime: '07:00',
    endTime: '15:00', // 8 hours, no lunch
    ...over,
  } as TimeEntry;
}

function card(employeeId: string, entries: Partial<TimeEntry>[]): TimeCard {
  return {
    id: `tc-${employeeId}`,
    createdAt: '',
    updatedAt: '',
    employeeId,
    weekStarting: '2026-04-13',
    entries: entries.map((e) => entry(e)),
    status: 'APPROVED',
  } as TimeCard;
}

describe('buildJobCostBreakdown', () => {
  it('buckets AP line items by costCode + sums lineTotal', () => {
    const r = buildJobCostBreakdown({
      jobId: 'job-A',
      apInvoices: [
        ap({ id: 'api-1', status: 'APPROVED' }, [
          { costCode: '01-100', jobId: 'job-A', lineTotalCents: 5_000_00 },
          { costCode: '01-100', jobId: 'job-A', lineTotalCents: 3_000_00 },
          { costCode: '02-200', jobId: 'job-A', lineTotalCents: 2_000_00 },
        ]),
      ],
    });
    const c100 = r.rows.find((row) => row.costCode === '01-100');
    expect(c100?.apCents).toBe(8_000_00);
    expect(c100?.sourceCount).toBe(2);
    const c200 = r.rows.find((row) => row.costCode === '02-200');
    expect(c200?.apCents).toBe(2_000_00);
  });

  it('skips AP invoices in DRAFT/PENDING/REJECTED status', () => {
    const r = buildJobCostBreakdown({
      jobId: 'job-A',
      apInvoices: [
        ap({ id: 'api-1', status: 'DRAFT' }, [
          { costCode: '01-100', jobId: 'job-A', lineTotalCents: 99_999_00 },
        ]),
        ap({ id: 'api-2', status: 'APPROVED' }, [
          { costCode: '01-100', jobId: 'job-A', lineTotalCents: 100_00 },
        ]),
      ],
    });
    expect(r.rows.find((row) => row.costCode === '01-100')?.apCents).toBe(100_00);
  });

  it('respects line-level jobId override (multi-job AP invoice)', () => {
    const r = buildJobCostBreakdown({
      jobId: 'job-A',
      apInvoices: [
        ap({ id: 'api-1', status: 'APPROVED', jobId: 'job-OTHER' }, [
          { costCode: '01-100', jobId: 'job-A', lineTotalCents: 500_00 },
          { costCode: '01-100', jobId: 'job-OTHER', lineTotalCents: 99_999_00 },
        ]),
      ],
    });
    expect(r.rows.find((row) => row.costCode === '01-100')?.apCents).toBe(500_00);
  });

  it('header-only AP invoice rolls into UNCODED bucket', () => {
    const r = buildJobCostBreakdown({
      jobId: 'job-A',
      apInvoices: [
        ap({
          id: 'api-1',
          status: 'PAID',
          jobId: 'job-A',
          totalCents: 1_500_00,
        }),
      ],
    });
    const uncoded = r.rows.find((row) => row.costCode === UNCODED_BUCKET);
    expect(uncoded?.apCents).toBe(1_500_00);
  });

  it('expenses for the job land in UNCODED with their reimbursable amount', () => {
    const r = buildJobCostBreakdown({
      jobId: 'job-A',
      apInvoices: [],
      expenses: [
        exp({ id: 'exp-1', jobId: 'job-A', amountCents: 200_00 }),
        exp({
          id: 'exp-2',
          jobId: 'job-A',
          amountCents: 9_999_00,
          paidWithCompanyCard: true,
        }),
        exp({ id: 'exp-3', jobId: 'job-OTHER', amountCents: 50_00 }),
      ],
    });
    const uncoded = r.rows.find((row) => row.costCode === UNCODED_BUCKET);
    // Only out-of-pocket, only this job.
    expect(uncoded?.expenseCents).toBe(200_00);
  });

  it('time-card entries dollarize hours by classification rate', () => {
    const rates = new Map<DirClassification, number>([
      ['OPERATING_ENGINEER_GROUP_1', 60_00],
    ]);
    const classifications = new Map<string, DirClassification>([
      ['emp-1', 'OPERATING_ENGINEER_GROUP_1'],
    ]);
    const r = buildJobCostBreakdown({
      jobId: 'job-A',
      apInvoices: [],
      timeCards: [
        card('emp-1', [
          entry({ date: '2026-04-13', costCode: '03-300' }), // 8 hr
          entry({ date: '2026-04-14', costCode: '03-300' }), // 8 hr
          entry({ date: '2026-04-15' }), // no costCode → uncoded
          entry({ date: '2026-04-16', jobId: 'job-OTHER' }), // wrong job
        ]),
      ],
      laborRatesByClassification: rates,
      classificationByEmployeeId: classifications,
    });
    const c300 = r.rows.find((row) => row.costCode === '03-300');
    expect(c300?.laborCents).toBe(16 * 60_00);
    const uncoded = r.rows.find((row) => row.costCode === UNCODED_BUCKET);
    expect(uncoded?.laborCents).toBe(8 * 60_00);
  });

  it('mileage lands in UNCODED with reimbursable cents', () => {
    const r = buildJobCostBreakdown({
      jobId: 'job-A',
      apInvoices: [],
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
          businessMiles: 50,
          purpose: 'JOBSITE_TRAVEL',
          irsRateCentsPerMile: 67,
          jobId: 'job-A',
          reimbursed: false,
        } as MileageEntry,
      ],
    });
    const uncoded = r.rows.find((row) => row.costCode === UNCODED_BUCKET);
    expect(uncoded?.mileageCents).toBe(50 * 67);
  });

  it('budget-only codes appear with null actuals', () => {
    const budgetByCostCode = new Map<string, number>([
      ['04-400', 10_000_00],
    ]);
    const r = buildJobCostBreakdown({
      jobId: 'job-A',
      apInvoices: [],
      budgetByCostCode,
    });
    const row = r.rows.find((r) => r.costCode === '04-400');
    expect(row?.budgetCents).toBe(10_000_00);
    expect(row?.totalActualCents).toBe(0);
    expect(row?.varianceCents).toBe(10_000_00);
    expect(r.hasBudget).toBe(true);
  });

  it('variance turns negative when actual exceeds budget', () => {
    const r = buildJobCostBreakdown({
      jobId: 'job-A',
      apInvoices: [
        ap({ id: 'api-1', status: 'APPROVED' }, [
          { costCode: '04-400', jobId: 'job-A', lineTotalCents: 12_000_00 },
        ]),
      ],
      budgetByCostCode: new Map<string, number>([['04-400', 10_000_00]]),
    });
    const row = r.rows.find((r) => r.costCode === '04-400');
    expect(row?.varianceCents).toBe(-2_000_00);
    expect(row?.variancePercent).toBeCloseTo(-0.2, 4);
  });

  it('UNCODED bucket pinned to the bottom', () => {
    const r = buildJobCostBreakdown({
      jobId: 'job-A',
      apInvoices: [
        ap({ id: 'api-1', status: 'APPROVED' }, [
          { costCode: '99-999', jobId: 'job-A', lineTotalCents: 1_000_000_00 },
        ]),
        ap({ id: 'api-2', status: 'APPROVED' }, [
          { jobId: 'job-A', lineTotalCents: 50_00 }, // no costCode → uncoded
        ]),
      ],
    });
    expect(r.rows[r.rows.length - 1]?.costCode).toBe(UNCODED_BUCKET);
  });
});
