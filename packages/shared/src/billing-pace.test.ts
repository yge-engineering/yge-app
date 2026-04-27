import { describe, expect, it } from 'vitest';
import { buildBillingPaceReport } from './billing-pace';
import type { ApInvoice } from './ap-invoice';
import type { ArInvoice } from './ar-invoice';
import type { ChangeOrder } from './change-order';
import type { Job } from './job';

function job(over: Partial<Job>): Job {
  return {
    id: 'job-1',
    createdAt: '',
    updatedAt: '',
    projectName: 'Test Job',
    status: 'AWARDED',
    ...over,
  } as Job;
}

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'job-1',
    invoiceNumber: '1',
    customerName: 'Cal Fire',
    invoiceDate: '2026-04-15',
    source: 'MANUAL',
    lineItems: [],
    subtotalCents: 100_00,
    totalCents: 100_00,
    paidCents: 0,
    status: 'SENT',
    ...over,
  } as ArInvoice;
}

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'api-1',
    createdAt: '',
    updatedAt: '',
    vendorName: 'Acme',
    invoiceDate: '2026-04-15',
    totalCents: 100_00,
    paidCents: 0,
    status: 'APPROVED',
    lineItems: [],
    jobId: 'job-1',
    ...over,
  } as ApInvoice;
}

function co(over: Partial<ChangeOrder>): ChangeOrder {
  return {
    id: 'co-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'job-1',
    changeOrderNumber: 'CO-001',
    subject: 'CO',
    description: '',
    reason: 'OWNER_DIRECTED',
    lineItems: [],
    totalCostImpactCents: 0,
    totalScheduleImpactDays: 0,
    status: 'EXECUTED',
    ...over,
  } as ChangeOrder;
}

describe('buildBillingPaceReport', () => {
  it('ON_PACE when costShare and billedShare are within 5%', () => {
    const r = buildBillingPaceReport({
      jobs: [job({ id: 'job-1' })],
      arInvoices: [ar({ totalCents: 500_000_00 })],
      apInvoices: [ap({ totalCents: 400_000_00 })],
      changeOrders: [],
      originalContractByJobId: new Map([['job-1', 1_000_000_00]]),
      budgetByJobId: new Map([['job-1', 800_000_00]]),
    });
    // costShare = 400/800 = 50%; billedShare = 500/1000 = 50%
    expect(r.rows[0]?.flag).toBe('ON_PACE');
  });

  it('UNDER_BILLED_BAD when paceDelta < -15%', () => {
    const r = buildBillingPaceReport({
      jobs: [job({ id: 'job-1' })],
      arInvoices: [ar({ totalCents: 100_000_00 })],
      apInvoices: [ap({ totalCents: 600_000_00 })],
      changeOrders: [],
      originalContractByJobId: new Map([['job-1', 1_000_000_00]]),
      budgetByJobId: new Map([['job-1', 800_000_00]]),
    });
    // costShare = 600/800 = 75%; billedShare = 100/1000 = 10%; delta = -65%
    expect(r.rows[0]?.flag).toBe('UNDER_BILLED_BAD');
  });

  it('OVER_BILLED_HIGH when paceDelta > 15%', () => {
    const r = buildBillingPaceReport({
      jobs: [job({ id: 'job-1' })],
      arInvoices: [ar({ totalCents: 800_000_00 })],
      apInvoices: [ap({ totalCents: 100_000_00 })],
      changeOrders: [],
      originalContractByJobId: new Map([['job-1', 1_000_000_00]]),
      budgetByJobId: new Map([['job-1', 800_000_00]]),
    });
    // costShare = 100/800 = 12.5%; billedShare = 800/1000 = 80%; delta = +67.5%
    expect(r.rows[0]?.flag).toBe('OVER_BILLED_HIGH');
  });

  it('NO_BUDGET when budget is 0', () => {
    const r = buildBillingPaceReport({
      jobs: [job({ id: 'job-1' })],
      arInvoices: [ar({ totalCents: 100_000_00 })],
      apInvoices: [ap({ totalCents: 50_000_00 })],
      changeOrders: [],
      originalContractByJobId: new Map([['job-1', 1_000_000_00]]),
      budgetByJobId: new Map(),
    });
    expect(r.rows[0]?.flag).toBe('NO_BUDGET');
  });

  it('skips DRAFT and WRITTEN_OFF AR + non-APPROVED AP for cost', () => {
    const r = buildBillingPaceReport({
      jobs: [job({ id: 'job-1' })],
      arInvoices: [
        ar({ id: '1', status: 'DRAFT', totalCents: 99_999_00 }),
        ar({ id: '2', status: 'PAID', totalCents: 100_00 }),
      ],
      apInvoices: [
        ap({ id: '1', status: 'DRAFT', totalCents: 99_999_00 }),
        ap({ id: '2', status: 'REJECTED', totalCents: 99_999_00 }),
        ap({ id: '3', status: 'PAID', totalCents: 100_00 }),
      ],
      changeOrders: [],
      originalContractByJobId: new Map([['job-1', 1_000_00]]),
      budgetByJobId: new Map([['job-1', 1_000_00]]),
    });
    expect(r.rows[0]?.billedToDateCents).toBe(100_00);
    expect(r.rows[0]?.costsIncurredCents).toBe(100_00);
  });

  it('adjustedContract includes EXECUTED + APPROVED COs', () => {
    const r = buildBillingPaceReport({
      jobs: [job({ id: 'job-1' })],
      arInvoices: [],
      apInvoices: [],
      changeOrders: [
        co({ id: 'a', status: 'EXECUTED', totalCostImpactCents: 100_000_00 }),
        co({ id: 'b', status: 'APPROVED', totalCostImpactCents: 50_000_00 }),
        co({ id: 'c', status: 'PROPOSED', totalCostImpactCents: 999_999_00 }),
        co({ id: 'd', status: 'REJECTED', totalCostImpactCents: 999_999_00 }),
      ],
      originalContractByJobId: new Map([['job-1', 1_000_000_00]]),
      budgetByJobId: new Map([['job-1', 800_000_00]]),
    });
    expect(r.rows[0]?.adjustedContractCents).toBe(1_150_000_00);
  });

  it('estimatedUnderBilledCents = positive when under-billed', () => {
    const r = buildBillingPaceReport({
      jobs: [job({ id: 'job-1' })],
      arInvoices: [ar({ totalCents: 200_000_00 })],
      apInvoices: [ap({ totalCents: 600_000_00 })],
      changeOrders: [],
      originalContractByJobId: new Map([['job-1', 1_000_000_00]]),
      budgetByJobId: new Map([['job-1', 800_000_00]]),
    });
    // costShare = 75%; billedShare = 20%; gap = 55% × $1M = $550k
    expect(r.rows[0]?.estimatedUnderBilledCents).toBe(550_000_00);
  });

  it('rollup totalUnderBilledCents sums positive gaps only', () => {
    const r = buildBillingPaceReport({
      jobs: [
        job({ id: 'a', projectName: 'A' }),
        job({ id: 'b', projectName: 'B' }),
      ],
      arInvoices: [
        ar({ id: 'ar-a', jobId: 'a', totalCents: 100_000_00 }),
        ar({ id: 'ar-b', jobId: 'b', totalCents: 800_000_00 }),
      ],
      apInvoices: [
        ap({ id: 'ap-a', jobId: 'a', totalCents: 600_000_00 }),
        ap({ id: 'ap-b', jobId: 'b', totalCents: 100_000_00 }),
      ],
      changeOrders: [],
      originalContractByJobId: new Map([
        ['a', 1_000_000_00],
        ['b', 1_000_000_00],
      ]),
      budgetByJobId: new Map([
        ['a', 800_000_00],
        ['b', 800_000_00],
      ]),
    });
    // a: under-billed by ~$650k, b: over-billed (negative). Only a counts.
    expect(r.rollup.totalUnderBilledCents).toBeGreaterThan(0);
    expect(r.rollup.totalUnderBilledCents).toBeLessThan(700_000_00);
  });

  it('sorts UNDER_BILLED_BAD first, NO_BUDGET last', () => {
    const r = buildBillingPaceReport({
      jobs: [
        job({ id: 'nobudget' }),
        job({ id: 'onpace' }),
        job({ id: 'underbad' }),
      ],
      arInvoices: [
        ar({ id: 'ar-onpace', jobId: 'onpace', totalCents: 500_000_00 }),
        ar({ id: 'ar-underbad', jobId: 'underbad', totalCents: 100_000_00 }),
      ],
      apInvoices: [
        ap({ id: 'ap-onpace', jobId: 'onpace', totalCents: 400_000_00 }),
        ap({ id: 'ap-underbad', jobId: 'underbad', totalCents: 600_000_00 }),
      ],
      changeOrders: [],
      originalContractByJobId: new Map([
        ['onpace', 1_000_000_00],
        ['underbad', 1_000_000_00],
        ['nobudget', 1_000_000_00],
      ]),
      budgetByJobId: new Map([
        ['onpace', 800_000_00],
        ['underbad', 800_000_00],
      ]),
    });
    expect(r.rows.map((x) => x.jobId)).toEqual([
      'underbad',
      'onpace',
      'nobudget',
    ]);
  });
});
